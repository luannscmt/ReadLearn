"""
Script de execução do servidor web de estudos de inglês.
Execute no terminal:
    python run.py
"""
import webbrowser
import threading
import time
from english_study_app import create_app
from english_study_app.config import HOST, PORT

app = create_app()

def open_browser():
    """Abre o navegador automaticamente após iniciar o servidor."""
    time.sleep(1.2)
    url = f"http://{HOST}:{PORT}"
    print(f"\n[+] Abrindo a aplicacao no navegador: {url}")
    webbrowser.open(url)

if __name__ == "__main__":
    print("=" * 60)
    print("  🎧 English Audio & PDF Study Station")
    print(f"  Servidor iniciado em: http://{HOST}:{PORT}")
    print("  Pressione CTRL+C para encerrar o servidor.")
    print("=" * 60)

    # Iniciar thread para abrir o navegador automaticamente
    threading.Thread(target=open_browser, daemon=True).start()

    # Iniciar servidor Flask
    app.run(host=HOST, port=PORT, debug=False)
