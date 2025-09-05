# Fozzi Chatbot 🤖🌎

**Fozzi** é um assistente virtual inteligente para turistas, focado em Foz do Iguaçu e região da tríplice fronteira. Ele responde dúvidas, sugere roteiros, dá dicas de segurança, recomenda restaurantes e muito mais — tudo via WhatsApp ou teste local no terminal!

---

## 🚀 Funcionalidades

- **Atendimento via WhatsApp** (usando Baileys, sem navegador)
- **Modo de teste local** no terminal
- **Respostas rápidas** para perguntas frequentes (freeTierQA e staticQA)
- **Sugestão de roteiros turísticos**
- **Dicas de restaurantes e atrações**
- **Integração com Stripe para planos pagos**
- **Conexão com banco de dados PostgreSQL**
- **Uso de IA Gemini para respostas avançadas (planos pagos)**

---

## 📦 Estrutura do Projeto

```
Hackaton-main/
│
├── Chat/
│   ├── bot.js                # Inicialização principal do bot
│   ├── whatsapp/
│   │   ├── client-baileys.js # Cliente WhatsApp via Baileys
│   │   └── messageEvents.js  # Manipulação de mensagens recebidas
│   ├── services/
│   │   ├── localDataService.js # Carregamento de dados locais (Q&A, posts)
│   │   └── userService.js      # Gerenciamento de usuários e planos
│   ├── core/
│   │   └── handleCoreLogic.js  # Lógica central de respostas
│   ├── utils/
│   │   └── localTester.js      # Teste interativo local
│   ├── data/
│   │   ├── freeTierQA.json     # Perguntas e respostas para usuários gratuitos
│   │   └── staticQA.json       # Q&A estático
│   ├── .env                    # Configurações sensíveis (NÃO subir para o git)
│   └── package.json            # Dependências e scripts
│
├── docker-compose.yml          # Orquestração Docker
├── Dockerfile                  # Build da imagem Node.js
├── .gitignore                  # Ignora arquivos sensíveis e de build
└── README.md                   # Este arquivo
```

---

## ⚙️ Como rodar localmente

### 1. Pré-requisitos

- [Node.js](https://nodejs.org/) 18+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (opcional, recomendado)
- [PostgreSQL](https://www.postgresql.org/) rodando localmente (ou ajuste as variáveis no `.env`)

### 2. Instale as dependências

```bash
cd Chat
npm install
```

### 3. Configure o `.env`

Copie o arquivo `.env.example` (se existir) para `.env` e ajuste as variáveis conforme necessário. **Nunca suba seu `.env` para o repositório!**

### 4. Execute em modo local (terminal)

```bash
npm start
```
- O bot rodará em modo de teste local. Siga as instruções no terminal.

### 5. Execute via Docker (recomendado)

```bash
docker-compose up --build
```
- O QR Code do WhatsApp aparecerá no terminal. Escaneie com seu app para ativar o bot.

---

## 📝 Como funciona a base de conhecimento

- **freeTierQA.json**: Respostas rápidas para perguntas comuns de turistas (ex: "ola", "comprar no paraguai é seguro").
- **staticQA.json**: Q&A estático para temas recorrentes.
- **Posts e roteiros**: Sugestões de passeios, restaurantes e roteiros personalizados.
- **Planos pagos**: Usuários pagantes têm acesso a respostas com IA Gemini e funcionalidades premium.

---

## 🛡️ Segurança

- **NUNCA** suba arquivos `.env`, sessões do WhatsApp ou dados sensíveis para o repositório.
- O arquivo `.gitignore` já está configurado para proteger essas informações.

---

## 📄 Licença

Este projeto é de uso interno para demonstração de chatbot turístico.  
Todos os direitos reservados.

---

<div align="center">

© 2025 Fozzi Team — Todos os direitos reservados.  
Desenvolvido com 💚 para o turismo inteligente em Foz do Iguaçu!