"""
Pacote principal da aplicação de estudos de inglês.
"""
from datetime import datetime
from flask import Flask
from .config import SECRET_KEY

def _format_datetime_br(value):
    """Formata 'YYYY-MM-DD HH:MM:SS' para 'DD/MM/AAAA HH:MM' (exibição pt-BR)."""
    if not value:
        return ""
    try:
        dt = datetime.strptime(str(value)[:19], "%Y-%m-%d %H:%M:%S")
        return dt.strftime("%d/%m/%Y %H:%M")
    except ValueError:
        return str(value)

def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = SECRET_KEY

    # Filtro de template para datas em pt-BR
    app.template_filter("datetime_br")(_format_datetime_br)

    # Registrar rotas
    from .routes import main_bp
    app.register_blueprint(main_bp)

    # Inicializar banco de dados (cria/migra tabelas automaticamente)
    from .database import init_db
    init_db()

    return app
