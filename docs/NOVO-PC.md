# Abrir o projeto em um computador novo

Este repositório contém o código, os assets, o histórico Git e os dados demonstrativos do Bar do Nardo. Senhas, tokens, pedidos locais e arquivos temporários ficam fora do GitHub por segurança.

## 1. Instalar as ferramentas

No computador novo, instale:

- Git;
- Node.js 20.12 ou mais recente;
- Visual Studio Code;
- Codex, entrando na mesma conta OpenAI usada no computador anterior.

## 2. Baixar e executar o projeto

Abra o PowerShell e execute:

```powershell
git clone https://github.com/Edupimentel007/projeto-bar-restaurantes-app.git
cd projeto-bar-restaurantes-app
npm.cmd ci
Copy-Item .env.example .env
```

Abra o arquivo `.env` e defina valores privados para:

- `ADMIN_EMAIL`;
- `ADMIN_PASSWORD`, com pelo menos 12 caracteres;
- `ADMIN_SESSION_SECRET`, com pelo menos 32 caracteres aleatórios.

Não envie o `.env` para o GitHub. Depois, valide e inicie o sistema:

```powershell
npm.cmd run check
npm.cmd run dev
```

Links locais:

- Cliente: `http://localhost:3333/?mesa=m01`
- Administração: `http://localhost:3333/admin`

## 3. Vercel e dados publicados

O site publicado e os pedidos armazenados no Blob continuam ligados ao projeto existente na Vercel; eles não precisam ser copiados para o GitHub. Entre na mesma conta da Vercel no computador novo e, se quiser administrar deploys pela linha de comando, execute dentro desta pasta:

```powershell
npx.cmd vercel login
npx.cmd vercel link
```

Selecione o projeto existente `projeto-bar`. A pasta `.vercel` e os tokens continuam privados e não são versionados.

Os pedidos locais ficam em `data/store.json`, que também não é enviado ao GitHub. Uma instalação nova começa com `data/seed.json`. Caso seja necessário preservar pedidos locais, transfira `data/store.json` por um canal privado e seguro, nunca por este repositório público.

## 4. Celulares na mesma rede

Para abrir o servidor local em iPhone ou Android conectado ao mesmo Wi-Fi, execute uma vez o script abaixo em um PowerShell aberto como Administrador:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\allow-mobile-access.ps1
```

## 5. Histórico das conversas

O histórico do Codex não faz parte do Git. No computador novo, entre na mesma conta OpenAI, abra o Codex e procure esta conversa em **Recentes** ou na busca de conversas. Depois, abra a pasta clonada como diretório do projeto.

A sincronização da conversa e o acesso aos arquivos são separados: mesmo retomando o chat, o código precisa estar clonado no novo computador. Se a conversa não estiver sincronizada, este guia, o `README.md` e o histórico de commits preservam o estado técnico do projeto sem expor as credenciais que apareceram durante o desenvolvimento.

## 6. Atualizações futuras

Para baixar novas alterações:

```powershell
git pull origin main
npm.cmd ci
```

Para enviar alterações próprias, revise antes para garantir que nenhum segredo foi adicionado:

```powershell
git status
git add <arquivos>
git commit -m "Descrição da alteração"
git push origin main
```
