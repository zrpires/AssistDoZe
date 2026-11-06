# Validação — 6 de novembro de 2026

- `npm ci`: passou.
- `npm run check`: passou.
- `npm test`: 10 testes passaram, sem testes ignorados, em Node.js 22.
- Navegador Chromium: fluxo principal passou em 1366×900 e 390×844, sem erro JavaScript ou rolagem horizontal.
- Fontes externas bloqueadas durante a validação de navegador: interface continua utilizável com fontes locais.
- Cadastro de tarefa e despesa, persistência ao recarregar, conclusão/reabertura, exclusão, exportação e importação de backup e chat contextual verificados no navegador.

## Dependências da instalação final

O deploy na conta Vercel do proprietário ainda não foi executado. Não foram usadas chaves reais OpenAI/Stripe nem realizadas cobranças. A integração OpenAI foi testada com respostas simuladas. O microfone depende da permissão, do navegador e do dispositivo final; o teste em navegador automatizado validou o chat por texto. Siga o README para configurar as variáveis e fazer a validação final no domínio publicado.

A interface de acesso protegido à IA também foi verificada no navegador, com resposta simulada e envio da senha no cabeçalho Authorization.
