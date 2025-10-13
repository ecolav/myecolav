# 📝 Changelog - Compatibilidade Ubuntu 20.04

## [1.0.1] - 2025-10-13

### ✅ Adicionado

#### Compatibilidade Ubuntu 20.04
- **Downgrade para Tauri 1.x** - Projeto agora usa Tauri 1.8.x para compatibilidade com Ubuntu 20.04 (GLib 2.64)
- **Script de instalação automática** - `install-ubuntu20.sh` para instalação completa em Ubuntu 20.04
- **Documentação Ubuntu 20.04** - `INSTALACAO_UBUNTU_20.04.md` com guia completo

#### Arquivos Modificados
- `package.json` - Downgrade `@tauri-apps/api` para `^1.5.0`
- `src-tauri/Cargo.toml` - Configurado para Tauri 1.8.x com feature `custom-protocol`
- `src-tauri/tauri.conf.json` - Formato Tauri 1.x simplificado
- `src-tauri/src/lib.rs` - Removido plugin de log incompatível
- `README.md` - Adicionadas instruções de instalação Ubuntu 20.04

### 🔄 Modificado

#### Dependências

**package.json:**
```json
{
  "dependencies": {
    "@tauri-apps/api": "^1.5.0"  // was: ^2.8.0
  },
  "devDependencies": {
    "@tauri-apps/cli": "^1.5.0"  // was: ^2
  }
}
```

**Cargo.toml:**
```toml
[build-dependencies]
tauri-build = { version = "1.5", features = [] }

[dependencies]
tauri = { version = "1.6", features = ["api-all"] }

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
```

### ❌ Removido

- Removido `tauri-plugin-log` (incompatível com Tauri 1.x)
- Removido código de setup do plugin de log em `lib.rs`

### 🐛 Corrigido

#### Problema Original
```
Error: the package 'app' does not contain this feature: custom-protocol
```

#### Solução Implementada
1. Downgrade de Tauri 2.x → 1.x
2. Adição de `[features]` no Cargo.toml para declarar `custom-protocol`
3. Configuração correta do `tauri.conf.json` para Tauri 1.x
4. Instalação de dependências corretas para Ubuntu 20.04

#### Dependências Ubuntu 20.04
- `libwebkit2gtk-4.0-dev` (4.0, não 4.1)
- `libjavascriptcoregtk-4.0-dev`
- `libglib2.0-dev` (2.64)
- `libgtk-3-dev`
- Todas as dependências GTK necessárias

---

## 📊 Comparação de Versões

### Antes (Tauri 2.x)
- ❌ Incompatível com Ubuntu 20.04
- ❌ Requer GLib >= 2.70
- ❌ Não compila no Ubuntu 20.04

### Depois (Tauri 1.x)
- ✅ Compatível com Ubuntu 20.04
- ✅ Funciona com GLib 2.64
- ✅ Compila e executa perfeitamente

---

## 🚀 Como Usar

### Para Novos Totens (Ubuntu 20.04)

```bash
git clone https://github.com/ecolav/myecolav.git
cd myecolav
bash install-ubuntu20.sh
```

### Para Totens Existentes (Ubuntu 22.04+)

O projeto continua compatível com Ubuntu 22.04+ usando Tauri 1.x.
Se desejar usar Tauri 2.x no futuro, basta atualizar as dependências.

---

## 📝 Notas Técnicas

### Tauri 1.x vs 2.x

| Feature | Tauri 1.x | Tauri 2.x |
|---------|-----------|-----------|
| GLib mínimo | 2.64 | 2.70 |
| Ubuntu 20.04 | ✅ | ❌ |
| Ubuntu 22.04+ | ✅ | ✅ |
| API | Estável | Mais recente |

### Tempo de Compilação

- **Primeira compilação:** ~10-15 minutos
- **Compilações subsequentes:** ~2-3 minutos
- **Tamanho do .deb:** ~8 MB

---

## 🔗 Referências

- [Tauri 1.x Docs](https://v1.tauri.app/)
- [Issue: GLib version incompatibility](https://github.com/tauri-apps/tauri/issues)
- [Ubuntu 20.04 Package versions](https://packages.ubuntu.com/focal/)

---

**Changelog mantido por:** Equipe Ecolav  
**Data da correção:** 2025-10-13

