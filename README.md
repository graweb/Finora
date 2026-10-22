# Finora

Aplicação para acompanhamento de FIIs e controle financeiro de pessoa física e jurídica.

## Tecnologias

- Frontend: Next.js, React, Tailwind CSS e componentes shadcn/ui.
- Backend: FastAPI, SQLAlchemy e Alembic.
- Banco de dados: PostgreSQL.
- Integração de FIIs: BRAPI.

## Configuração local

### Requisitos

- Docker e Docker Compose.

### Variáveis de ambiente

Crie o arquivo de configuração do backend a partir do exemplo:

```bash
cp backend/.env.example backend/.env
```

As demais variáveis já possuem valores locais adequados para o Docker Compose.

### BRAPI: importação de FIIs

Para importar FIIs, é necessário criar uma conta na [BRAPI](https://brapi.dev/), gerar um token de acesso e configurá-lo no arquivo `backend/.env`:

```env
BRAPI_TOKEN=seu_token_da_brapi
BRAPI_FII_LIST_URL=https://brapi.dev/api/v2/fii/list
```

Não versione o token. O arquivo `backend/.env` já está ignorado pelo Git.

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
