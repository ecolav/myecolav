# 🌐 Configuração de Rede - MyEcolav

Este guia explica como habilitar o MyEcolav para acesso via rede local, permitindo que outros computadores acessem o aplicativo através do navegador web.

## 📋 Pré-requisitos

- Node.js instalado
- Computador com balança conectada
- Outros computadores na mesma rede local
- Firewall configurado para permitir conexões na porta escolhida

## 🚀 Como Configurar

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar o Servidor de Rede

1. Abra o aplicativo MyEcolav
2. Vá para **Configurações** → **Rede**
3. Configure:
   - ✅ **Habilitar servidor de rede**
   - **Porta**: 3000 (ou outra porta disponível)
   - **Host/Interface**: 0.0.0.0 (para permitir acesso de outros computadores)
   - ✅ **Iniciar automaticamente** (opcional)

### 3. Iniciar o Servidor

Execute o comando no terminal:

```bash
npm run network
```

Este comando irá:
1. Fazer o build do projeto
2. Iniciar o servidor web na porta configurada
3. Exibir as URLs de acesso

### 4. Acessar de Outros Computadores

O servidor exibirá algo como:

```
🚀 Servidor iniciado!
📱 Acesso local: http://localhost:3000
🌐 Acesso em rede: http://192.168.1.100:3000

Para acessar de outro computador na rede:
   Abra o navegador e acesse: http://192.168.1.100:3000
```

Use a URL de **acesso em rede** em outros computadores.

## 🔧 Configurações Avançadas

### Alterar Porta

Se a porta 3000 estiver em uso, altere nas configurações:

1. **Configurações** → **Rede** → **Porta do Servidor**
2. Escolha uma porta disponível (ex: 3001, 8080, 9000)
3. Reinicie o servidor

### Configurar Firewall

**Windows:**
1. Painel de Controle → Sistema e Segurança → Firewall do Windows
2. Permitir um aplicativo pelo Firewall
3. Adicionar Node.js ou a porta específica

**Linux:**
```bash
sudo ufw allow 3000
```

### Troubleshooting

**Erro "Porta em uso":**
- Mude a porta nas configurações
- Verifique se outro processo está usando a porta: `netstat -an | grep 3000`

**Não consegue acessar de outros computadores:**
- Verifique se o firewall está configurado
- Confirme que ambos os computadores estão na mesma rede
- Teste ping entre os computadores

**Servidor não inicia:**
- Verifique se o Node.js está instalado
- Execute `npm install` para instalar dependências
- Verifique se a porta está disponível

## 📱 Comandos Disponíveis

```bash
# Iniciar servidor de rede (build + servidor)
npm run network

# Apenas iniciar servidor (se já fez build)
npm run serve

# Build do projeto
npm run build

# Modo desenvolvimento local
npm run dev
```

## 🔒 Segurança

- O servidor é para uso em rede local apenas
- Não exponha na internet pública
- Use firewall para controlar acesso
- Considere autenticação se necessário

## 📞 Suporte

Se encontrar problemas:

1. Verifique as configurações de rede
2. Teste a conectividade entre computadores
3. Verifique logs do servidor no terminal
4. Confirme se todas as dependências estão instaladas

---

**Nota:** Este servidor é para desenvolvimento e uso interno. Para produção, considere usar um servidor web mais robusto como Nginx ou Apache.


