import os
from pathlib import Path

# Raiz do projeto de áudios (onde ficam as subpastas com os arquivos)
BASE_DIR = Path(__file__).resolve().parent.parent

# Diretório para armazenamento de dados (banco SQLite)
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

DB_PATH = DATA_DIR / "study_stats.db"

# Extensões de arquivos suportadas
AUDIO_EXTENSIONS = {".mp3", ".m4a", ".wav", ".ogg", ".aac", ".flac"}
PDF_EXTENSIONS = {".pdf"}
SYNC_EXTENSIONS = {".json"}

# Pastas que devem ser ignoradas durante a varredura
IGNORED_DIRS = {
    "english_study_app",
    "data",
    "__pycache__",
    ".git",
    ".idea",
    ".vscode",
    "venv",
    ".venv"
}

# Configurações do Flask
SECRET_KEY = os.environ.get("SECRET_KEY", "english-study-secret-key-2026")
PORT = 5000
HOST = "127.0.0.1"
