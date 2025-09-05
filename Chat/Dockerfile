# 1. Imagem Base
FROM node:lts-slim

# 2. Diretório de Trabalho
WORKDIR /app

# 3. Copiar package.json e instalar dependências
COPY Chat/package*.json ./
RUN npm install --production

# 4. Copiar código da aplicação
COPY Chat/ ./

# 5. Criar diretórios necessários
RUN mkdir -p ./session ./data && chown -R node:node ./session ./data

# 6. Usar usuário node para segurança
USER node

# 7. Expor porta
EXPOSE 3000

# 8. Comando de inicialização
CMD ["node", "bot.js"]