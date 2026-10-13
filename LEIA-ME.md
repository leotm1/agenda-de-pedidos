# Agenda de Pedidos — app Android

App nativo para Android que lembra quais pedidos fazer a cada fornecedor, em quais dias da semana, com notificação no celular, botão de WhatsApp e link do pedido.

- **Notificações nativas do Android**: tocam no horário de cada fornecedor, com o app fechado e a tela bloqueada. A notificação traz os botões **Marcar como feito** e **Abrir WhatsApp**.
- Os avisos são agendados para os próximos 35 dias e renovados sempre que você abre o app. Abra o app pelo menos uma vez por mês.
- Marcar um pedido como feito cancela só o aviso daquele dia.
- Os dados ficam salvos no próprio celular.

---

## Como gerar o arquivo .apk (grátis, pelo GitHub)

Você não precisa instalar nada no computador. O GitHub monta o app na nuvem.

1. Crie uma conta em **github.com** (se ainda não tiver).
2. Clique em **New repository** (botão verde). Dê o nome `agenda-de-pedidos` e clique em **Create repository**.
3. Na página do repositório, clique em **uploading an existing file**.
4. Descompacte o arquivo `agenda-de-pedidos-android.zip` no computador e **arraste todo o conteúdo da pasta** (`www`, `assets`, `native`, `.github`, `package.json`, `capacitor.config.json`, `LEIA-ME.md`) para a página. Clique em **Commit changes**.
   - No Mac, a pasta `.github` fica oculta. Se ela não subir, veja o passo extra abaixo.
5. Abra a aba **Actions**. O processo **Gerar APK** começa sozinho e leva de 5 a 8 minutos. Quando aparecer o ✅ verde, está pronto.
6. Na página inicial do repositório, à direita, clique em **Releases** e depois em **AgendaDePedidos.apk** para baixar.

**Passo extra (só se a pasta `.github` não subiu):** no repositório, clique em **Add file → Create new file**. No nome, digite `.github/workflows/gerar-apk.yml`. Cole o conteúdo do arquivo `gerar-apk.yml` que está dentro da pasta `.github/workflows` do zip e clique em **Commit changes**.

## Como instalar no celular

1. No celular Android, abra o repositório no navegador → **Releases** → toque em **AgendaDePedidos.apk** para baixar.
2. Toque no arquivo baixado. O Android vai pedir para **permitir instalar apps desta fonte**. Permita para o navegador e volte.
3. Toque em **Instalar**. Se aparecer um aviso do Play Protect, toque em **Instalar mesmo assim**. Ele aparece porque o app não veio da Play Store.
4. Abra o app, cadastre um fornecedor e toque em **Permitir** quando o celular pedir para mostrar notificações.

## Ajustes recomendados no celular

- **Ajustes do app → Testar notificação**: a notificação de teste chega em 10 segundos. Bloqueie a tela para conferir.
- Se o app mostrar **"Permitir horário exato"**, toque e libere **Alarmes e lembretes**. Assim o aviso toca no minuto certo.
- Em celulares **Xiaomi, Samsung e Motorola**, vá em **Configurações → Apps → Agenda de Pedidos → Bateria** e escolha **Sem restrições**. Sem isso, o sistema pode atrasar ou bloquear os avisos.

## Atualizar o app

Para mudar algo no app, altere os arquivos no GitHub. Uma nova versão aparece em **Releases**. Basta instalar por cima: os dados são mantidos.

## Trazer os dados da versão web

Na versão web, vá em **Ajustes → Exportar backup**. No app Android, vá em **Ajustes → Importar** e cole o texto ou escolha o arquivo.

---

### Para quem desenvolve

Projeto em Capacitor 6. A tela é `www/index.html` + `www/app.js`, e os plugins usados são local-notifications, preferences, app, app-launcher e share.

Para compilar localmente, você precisa de Node 20, JDK 17 e Android SDK:

```
npm install
npx cap add android
npx @capacitor/assets generate --android
# adicionar ao AndroidManifest.xml as permissões POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM, USE_EXACT_ALARM, RECEIVE_BOOT_COMPLETED
cp native/ic_stat_pedido.xml android/app/src/main/res/drawable/
npx cap sync android
cd android && ./gradlew assembleDebug
```
