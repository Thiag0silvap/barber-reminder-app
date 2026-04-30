# Barber Reminder

Aplicativo mobile para barbearias acompanharem clientes, histórico de atendimentos e previsão automática de retorno.

## Objetivo

Muitos clientes têm uma frequência própria para cortar cabelo. O Barber Reminder permite cadastrar o cliente, registrar cada atendimento e deixar o app calcular a recorrência com base no histórico. Quando chegar o período ideal de retorno, o barbeiro consegue abrir uma conversa no WhatsApp com mensagem pronta.

O projeto foi pensado para funcionar sem servidor e sem banco online, usando armazenamento local no próprio dispositivo.

## Funcionalidades

- Cadastro de clientes com nome, WhatsApp e primeira visita.
- Histórico local de atendimentos.
- Cálculo automático de recorrência por cliente.
- Sugestão de próxima visita.
- Lista de clientes para chamar hoje.
- Abertura do WhatsApp com mensagem pronta.
- Dashboard com indicadores da carteira.
- Configuração de mensagem padrão do WhatsApp.
- Lembrete local diário para revisar clientes.
- Exportação de backup em JSON.
- Interface mobile com foco em uso rápido no balcão.

## Stack

- Expo
- React Native
- TypeScript
- Expo Router
- Expo SQLite
- Expo Go para execução durante o desenvolvimento

## Como Rodar

Instale as dependências:

```bash
npm install
```

Inicie o app:

```bash
npx expo start
```

Para limpar cache do Metro:

```bash
npx expo start -c
```

## Estrutura Principal

```txt
app/
  (tabs)/
    index.tsx       # Agenda, cadastro e registro de atendimentos
    explore.tsx     # Insights da carteira
    settings.tsx    # Configurações e lembretes
src/
  database/         # Conexão, migrations e repositories SQLite
  services/         # Integrações, como WhatsApp
  types/            # Tipos da aplicação
  utils/            # Regras de cálculo de recorrência
```

## Fluxo de Git

Branches principais:

- `develop`: branch de integração.
- `feature/nome-da-feature`: branch para cada melhoria.

Padrão de commits em português:

```bash
feat: descrição da nova funcionalidade
fix: descrição da correção
refactor: descrição da melhoria interna
docs: descrição da documentação
chore: descrição de tarefa técnica
```

Exemplo:

```bash
git checkout develop
git pull
git checkout -b feature/nova-melhoria
git add .
git commit -m "feat: adiciona nova melhoria"
git push -u origin feature/nova-melhoria
```

## Conceito do Produto

O barbeiro não precisa informar manualmente a recorrência do cliente. O app aprende a frequência a partir dos atendimentos registrados. Com dois ou mais registros, o sistema começa a calcular o intervalo médio e sugere a próxima data ideal para contato.

## Status

Projeto em evolução. A base atual já cobre o fluxo principal local-first: cadastro, histórico, recorrência automática, WhatsApp e dashboard.
