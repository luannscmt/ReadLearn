"""
Estimativa de duração de arquivos de áudio sem dependências externas.

Para MP3, lê apenas o começo do arquivo:
  - Se o arquivo tem marcador VBR (Xing/Info), usa o número de frames.
  - Caso contrário (CBR típico), usa o bitrate do primeiro frame
    para estimar: duração ≈ (tamanho do arquivo) / (bitrate).

Qualquer falha retorna None (duração desconhecida) — nunca lança exceção.
"""

import struct

# Número de amostras por frame: chave (versão, camada)
# versão: 3=MPEG1, 2=MPEG2, 0=MPEG2.5 | camada: 1=III, 2=II, 3=I
SAMPLES_PER_FRAME = {
    (3, 1): 1152, (3, 2): 1152, (3, 3): 384,
    (2, 1): 576,  (2, 2): 1152, (2, 3): 384,
    (0, 1): 576,  (0, 2): 1152, (0, 3): 384,
}

# Taxas de amostragem (Hz) por versão, índice 0..2
SAMPLE_RATES = {
    3: [44100, 48000, 32000],
    2: [22050, 24000, 16000],
    0: [11025, 12000, 8000],
}

# Bitrates em kbps por (versão, camada), índice 1..14 (0 = free format)
BITRATES_KBPS = {
    (3, 1): [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    (3, 2): [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    (3, 3): [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    (2, 1): [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    (2, 2): [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
    (2, 3): [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
    (0, 1): [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    (0, 2): [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
    (0, 3): [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
}


def _estimate_mp3_duration(file_path):
    try:
        # 1) Localizar o início do primeiro frame (pular tag ID3v2 se houver)
        with open(file_path, "rb") as f:
            head = f.read(10)
        if len(head) < 4:
            return None
        offset = 0
        if head[:3] == b"ID3":
            if len(head) < 10:
                return None
            size = 0
            for byte in head[6:10]:
                size = (size << 7) | (byte & 0x7F)
            offset = 10 + size

        # 2) Ler cabeçalho do primeiro frame + payload (para procurar Xing/Info)
        with open(file_path, "rb") as f:
            f.seek(offset)
            chunk = f.read(256)
        if len(chunk) < 4:
            return None
        if chunk[0] != 0xFF or (chunk[1] & 0xE0) != 0xE0:
            return None

        version = (chunk[1] >> 3) & 0x03      # 3 MPEG1 | 2 MPEG2 | 0 MPEG2.5
        layer = (chunk[1] >> 1) & 0x03        # 1 Layer III | 2 Layer II | 3 Layer I
        if version == 1 or layer == 0:
            return None
        if (version, layer) not in SAMPLES_PER_FRAME:
            return None

        has_crc = (chunk[1] & 0x01) == 0
        sample_idx = (chunk[2] >> 2) & 0x03
        bitrate_idx = (chunk[2] >> 4) & 0x0F
        channel_mode = (chunk[3] >> 6) & 0x03

        rates = SAMPLE_RATES.get(version)
        if rates is None or sample_idx >= 3:
            return None
        sample_rate = rates[sample_idx]

        samples_per_frame = SAMPLES_PER_FRAME[(version, layer)]

        # 3) Procurar marcador VBR (Xing/Info) no início do payload
        side_info = 0
        if version == 3:      # MPEG1
            side_info = 17 if channel_mode == 3 else 32
        else:                 # MPEG2 / MPEG2.5
            side_info = 9 if channel_mode == 3 else 17
        payload_start = 4 + (2 if has_crc else 0) + side_info
        search_zone = chunk[payload_start:payload_start + 128]
        vbr_pos = -1
        for marker in (b"Xing", b"Info"):
            idx = search_zone.find(marker)
            if idx >= 0:
                vbr_pos = payload_start + idx
                break

        if vbr_pos >= 0 and vbr_pos + 12 <= len(chunk):
            # Estrutura do cabeçalho Xing/Info: 'Xing'(4) + flags(4) + frames(4)...
            flags = struct.unpack(">I", chunk[vbr_pos + 4:vbr_pos + 8])[0]
            if flags & 0x01:
                frames = struct.unpack(">I", chunk[vbr_pos + 8:vbr_pos + 12])[0]
                if frames and frames > 0:
                    return frames * samples_per_frame / sample_rate

        # 4) Sem Xing: estimativa por bitrate (CBR)
        if bitrate_idx == 0 or bitrate_idx >= 15:
            return None  # free format/desconhecido
        table = BITRATES_KBPS.get((version, layer))
        if table is None:
            return None
        bitrate_bps = table[bitrate_idx] * 1000
        if bitrate_bps <= 0:
            return None

        file_size = __import__("os").path.getsize(file_path)
        audio_bytes = max(0, file_size - offset)
        return audio_bytes * 8 / bitrate_bps
    except Exception:
        return None


def estimate_audio_duration(path):
    """Duração aproximada em segundos ou None (formato desconhecido/falha)."""
    try:
        suffix = str(path).lower().rsplit(".", 1)[-1]
    except Exception:
        suffix = ""
    if suffix == "mp3":
        seconds = _estimate_mp3_duration(path)
        if seconds:
            return int(round(seconds))
    return None


def format_clock(seconds):
    """Segundos -> '13:24' ou '1:04:12' (para a duração de um arquivo)."""
    if not seconds:
        return None
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


def format_span(seconds):
    """Segundos -> '2h 05min', '42min' ou '50s' (para totais de tempo escutado)."""
    if not seconds:
        return "0min"
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}h {m:02d}min"
    if m:
        return f"{m}min"
    return f"{s}s"
