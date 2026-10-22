# Finora

Aplicação para acompanhamento de FIIs e controle financeiro de pessoa física e jurídica.

## Tecnologias

- Frontend: Next.js, React, Tailwind CSS e componentes shadcn/ui.
- Backend: FastAPI, SQLAlchemy e Alembic.
- Banco de dados: PostgreSQL.
- Importação de FIIs: crawler do Funds Explorer.

## Configuração local

### Requisitos

- Docker e Docker Compose.

### Variáveis de ambiente

Crie o arquivo de configuração do backend a partir do exemplo:

```bash
cp backend/.env.example backend/.env
```

As demais variáveis já possuem valores locais adequados para o Docker Compose.

### Importação pelo Funds Explorer

O sistema consulta o Funds Explorer por meio de um crawler executado em segundo plano. A importação aceita até cinco tickers por vez e salva os dados encontrados na base local. O endereço-base pode ser alterado em `backend/.env`:

```env
FUNDS_EXPLORER_BASE_URL=https://www.fundsexplorer.com.br
```

Não é necessário configurar token de API para importar FIIs.

### Subir o projeto

```bash
docker compose up -d --build
```

Depois, acesse:

- Frontend: http://localhost:3000
- API: http://localhost:8000
- Documentação da API: http://localhost:8000/docs

As migrations são aplicadas automaticamente ao iniciar o serviço do backend.

## Comandos úteis

Verificar os serviços:

```bash
docker compose ps
```

Ver os logs:

```bash
docker compose logs -f
```

Executar as migrations manualmente:

```bash
docker compose exec backend alembic upgrade head
```

Recriar o banco a partir das migrations:

```bash
docker compose exec backend alembic downgrade base
docker compose exec backend alembic upgrade head
```

> Esse último comando remove todos os dados locais do banco.

Parar os serviços:

```bash
docker compose down
```
