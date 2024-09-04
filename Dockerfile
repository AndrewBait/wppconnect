# Use uma imagem Node.js como base
FROM node:20

# Defina o diretório de trabalho no contêiner
WORKDIR /app

# Copie o arquivo package.json e package-lock.json para o diretório de trabalho
COPY package*.json ./

# Instale as dependências do sistema necessárias para o Sharp
RUN apt-get update && apt-get install -y \
    libvips-dev \
    build-essential

# Instale as dependências do projeto
RUN npm install

# Copie todos os arquivos do projeto para o diretório de trabalho
COPY . .

# Gere o certificado SSL autoassinado para desenvolvimento
RUN apt-get install -y openssl && \
    openssl req -nodes -new -x509 -keyout server.key -out server.cert -subj "/C=US/ST=State/L=City/O=Organization/OU=Unit/CN=localhost"

# Gere a build do projeto
RUN npm run build

# Exponha a porta que o NestJS está usando (3000)
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["npm", "run", "start:dev"]
