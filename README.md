# Bar do Nardo

MVP de pedidos do Bar do Nardo: o cliente acessa o cardápio da mesa por QR Code, monta o pedido, confirma um pagamento Pix demonstrativo e o pedido liberado aparece no painel do estabelecimento.

## Demonstração publicada

- Cardápio da Mesa 01: https://projeto-bar-mu.vercel.app/?mesa=m01
- Administração: https://projeto-bar-mu.vercel.app/admin

O painel administrativo exige as credenciais privadas configuradas na Vercel.

## O que já está pronto

- Cardápio responsivo para cliente, vinculado à mesa pela URL.
- Tema claro/escuro no cardápio e na administração, com preferência salva no navegador.
- Experiência mobile completa para iOS e Android, incluindo áreas seguras de notch, navegação fixa, painéis em formato de bottom sheet, campos sem zoom automático e layouts testados de 280 a 390 px.
- Instalação como aplicativo preservando o contexto: o atalho do cliente mantém a mesa do QR Code e o atalho administrativo abre o painel.
- Categorias, busca, carrinho, quantidades e observação do pedido.
- Fluxo Pix de demonstração com orientação para pagamento no cartão pelo balcão. O pedido somente vai para a fila após a confirmação.
- Tela de acompanhamento do pedido, com data e horário, incluindo aviso de retirada no balcão somente quando estiver pronto e ainda não entregue.
- Login demonstrativo de administração.
- Painel com indicadores, central de pedidos com data e horário, busca, filtros, histórico e detalhes completos, gestão de disponibilidade do cardápio e links de QR das mesas.
- Mesas 01 a 20 configuradas em ordem, cada uma com token, link, manifesto mobile e QR Code próprios.
- Cadastro completo em **Administração > Cardápio**, com nome, marca, descrição, categoria, preço, volume/tamanho, embalagem, SKU, imagem, texto alternativo, emoji, selo, destaque e disponibilidade.
- Produtos desmarcados como indisponíveis no Admin desaparecem do cardápio e do carrinho do cliente, retornando automaticamente quando reativados.
- Imagens locais dos produtos organizadas em `public/assets/products/`, com originais transparentes preservados e 42 variantes responsivas AVIF/WebP em `public/assets/responsive/` para carregamento rápido no celular.
- Diálogos acessíveis com foco inicial, navegação por teclado, restauração de foco e isolamento do conteúdo ao fundo para VoiceOver e TalkBack.
- Dados persistidos em `data/store.json` no desenvolvimento e em Vercel Blob privado no preview publicado.

## Como executar

É necessário Node.js 20.12 ou mais recente. As dependências externas geram os QR Codes e conectam o armazenamento privado da Vercel.

~~~powershell
cd projeto-bar
npm.cmd install
Copy-Item .env.example .env
# Preencha ADMIN_EMAIL, ADMIN_PASSWORD e ADMIN_SESSION_SECRET no arquivo .env.
npm.cmd run dev
~~~

Para permitir que iPhones e Androids da mesma rede Wi-Fi abram os QR Codes, execute uma vez o arquivo abaixo como Administrador no PowerShell:

~~~powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\allow-mobile-access.ps1
~~~

O servidor detecta automaticamente o IP da rede e usa esse endereço nos links e QR Codes. Em produção, configure `PUBLIC_BASE_URL` com o domínio HTTPS definitivo.

Abra http://localhost:3333/?mesa=m01 no navegador.

Para conferir o painel administrativo, use o botão Área do bar ou abra http://localhost:3333/admin.

As credenciais não ficam no código nem no repositório. Configure valores próprios no arquivo `.env` local ou nas variáveis de ambiente da hospedagem:

~~~powershell
$env:ADMIN_EMAIL = "dono@seubar.com"
$env:ADMIN_PASSWORD = "troque-esta-senha"
$env:ADMIN_SESSION_SECRET = "use-um-segredo-longo-e-aleatorio"
$env:PUBLIC_BASE_URL = "https://pedidos.seubar.com"
npm.cmd run dev
~~~

## Preview na Vercel

Cliente e administração são publicados juntos no mesmo projeto:

- Cardápio: `https://seu-projeto.vercel.app/?mesa=m01`
- Administração: `https://seu-projeto.vercel.app/admin`

O servidor Node da raiz é reconhecido diretamente pela Vercel. O arquivo `vercel.json` mantém o acesso direto a `/admin`, e o módulo `lib/store.js` seleciona automaticamente o backend de dados:

- sem `BLOB_READ_WRITE_TOKEN`: usa `data/store.json` somente no desenvolvimento local;
- com `BLOB_READ_WRITE_TOKEN`: usa o Blob privado conectado ao projeto.

Na Vercel, a aplicação falha de forma segura se o Blob privado ou as credenciais não estiverem configurados. O primeiro acesso inicializa o Blob exclusivamente com `data/seed.json`, que contém apenas dados demonstrativos sanitizados. Escritas concorrentes usam ETag e repetição automática para não sobrescrever pedidos.

O Pix desta versão continua demonstrativo. Antes de receber pagamentos reais, use um gateway com webhook e migre pedidos/produtos para um banco transacional, como PostgreSQL.

Para restaurar os dados iniciais depois dos testes:

~~~powershell
npm.cmd run reset-data
~~~

O comando salva uma cópia do estado anterior em data/backups antes de restaurar a demonstração.

Para verificar a sintaxe dos arquivos JavaScript:

~~~powershell
npm.cmd run check
~~~

## Estrutura

~~~text
projeto-bar/
├── lib/
│   └── store.js          Persistência local ou Vercel Blob privado
├── data/
│   ├── seed.json          Dados-base que podem ser restaurados
│   └── store.json         Dados locais ignorados pelo Git e pelo deploy
├── public/
│   ├── assets/
│   │   ├── products/              Imagens locais dos produtos do cardápio
│   │   ├── responsive/            Versões AVIF/WebP para telas e redes móveis
│   │   └── bar-do-nardo-logo.png  Logo em PNG com fundo transparente
│   ├── index.html         Entrada da interface
│   ├── manifest.json      Manifesto estático de compatibilidade
│   └── src/
│       ├── admin.js       Painel, pedidos, cardápio e mesas
│       ├── api.js         Comunicação com a API local
│       ├── app.js         Estado, navegação e eventos da aplicação
│       ├── client.js      Cardápio, carrinho e pagamento do cliente
│       ├── images.js      Imagens responsivas com fallback dos originais
│       ├── mobile.css     Compatibilidade comum entre iOS e Android
│       ├── styles.css     Design responsivo
│       └── utils.js       Formatação e componentes compartilhados
├── scripts/
│   ├── allow-mobile-access.ps1  Libera a porta 3333 somente na rede privada
│   ├── configure-tables.js      Mantém as Mesas 01 a 20 em ordem
│   └── reset-data.js            Restauração segura dos dados de demonstração
├── vercel.json            Configuração do preview e rota direta do admin
├── server.js              API e servidor Node local/Vercel
└── package.json
~~~

## Fluxo de pedidos

1. A mesa abre a URL indicada no QR Code, por exemplo `?mesa=m01`; cada token de `m01` a `m20` identifica somente sua respectiva mesa.
2. O cliente adiciona produtos e revisa o carrinho.
3. O servidor cria o pedido como aguardando pagamento.
4. Ao confirmar o Pix demonstrativo, o pedido passa para Novo e aparece no painel.
5. O administrador move o pedido entre Novo, Em preparo, Pronto e Entregue.

Pedidos ainda não pagos nunca entram no faturamento nem na fila operacional.

O QR Code determina a mesa: o cliente não escolhe nem troca a mesa dentro do cardápio. O cardápio público recebe apenas produtos e a mesa vinculada; dados de pedidos e gestão permanecem na API administrativa autenticada.

## Limites desta primeira versão

O Pix e a autenticação servem para demonstração local. Antes de produção, devem ser incluídos:

- Gateway Pix real com webhook assinado para confirmar pagamentos.
- Usuários persistidos, hash de senha, permissões e proteção contra tentativas indevidas. O preview já usa sessão stateless assinada com HMAC.
- Banco de dados (PostgreSQL, por exemplo), backup e auditoria.
- Isolamento por estabelecimento, estoque, impressão e regras fiscais.

Os QR Codes já são gerados de verdade a partir dos links das mesas. O servidor também separa pedido e pagamento, valida o total no backend e exige uma sessão administrativa para alterar pedidos, produtos e mesas, deixando a próxima integração mais direta.

As marcas e imagens de produtos presentes neste protótipo são usadas apenas para demonstração visual. Revise as autorizações de uso antes de uma operação comercial pública.
