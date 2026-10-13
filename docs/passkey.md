# パスキー (FIDO2 / WebAuthn) によるログイン

ログインはパスキーで行う。パスワードは使わない (旧アカウントの移行期間を除く)。

- **ログイン**: ログイン画面の「パスキーでログイン」→ 端末の指紋・顔認証・PIN、またはスマホ (QR コード) で確認する。メールアドレスの入力は不要
- **新規登録** (`ALLOW_SIGNUP=true` のときだけ): 表示名とメールアドレスを入力 → パスキーを作成するとアカウントができてログインした状態になる
- **パスキーの追加・削除**: 設定画面の「パスキー」。最後の 1 つは削除できない

## 注意点

- **パスキーは公開 URL のホスト名に紐づく。** `BETTER_AUTH_URL` のドメインを変えると、登録済みのパスキーはすべて使えなくなる (後述の「すべてのパスキーを失ったとき」の手順で登録し直す)
  - 同じドメインのままサーバーを移す (Lightsail → 自宅など) のは問題ない
- 端末の紛失に備えて、**2 つ以上** 登録しておく。iCloud キーチェーン / Google パスワードマネージャー / 1Password などに保存されるパスキーは端末間で同期されるので失いにくい (設定画面に「端末間で同期」と表示される)
- 開発環境 (`http://localhost:3000`) でもパスキーは使える。`127.0.0.1` や LAN の IP アドレスで開くと使えないので、`localhost` で開く

## パスワードで作った旧アカウントの移行

パスキー導入前に作ったアカウントは、パスキーを登録するまでパスワードでしかログインできない。一時的にパスワードでのログインを許可して移行する。

1. `.env.production` に `ALLOW_PASSWORD_LOGIN="true"` を追加して再起動する

   ```bash
   docker compose -f compose.tunnel.yaml up -d   # Lightsail の場合は -f なし
   ```

2. ログイン画面の「パスワードでログイン」からログインする (画面上部に「パスキーが未登録です」と表示される)
3. 設定画面の「パスキー」→「パスキーを追加」で登録する。別の端末からもログインして追加しておくとよい
4. 一度ログアウトし、「パスキーでログイン」でログインできることを確認する
5. `ALLOW_PASSWORD_LOGIN` を `"false"` に戻して (または行を消して) 再起動する

> 移行後もパスワードは DB に残るが、`ALLOW_PASSWORD_LOGIN` が `true` でない限りパスワードでのログインはできない。

## すべてのパスキーを失ったとき (またはドメインを変えたとき)

一時的に新規登録を許可して仮のアカウントでパスキーを作り、そのパスキーを元のアカウントへ付け替える。SwitchBot の設定や履歴はそのまま残る。

1. `.env.production` を `ALLOW_SIGNUP="true"` にして再起動し、**元とは別のメールアドレス** (例: `recovery@example.com`) でアカウントを作成する
2. `ALLOW_SIGNUP="false"` に戻して再起動する
3. アプリを止めて、仮アカウントのパスキーを元のアカウントへ移し、仮アカウントを削除する (メールアドレスは自分のものに置き換える)

   ```bash
   docker compose -f compose.tunnel.yaml stop app
   docker run --rm -it -v sasuke_sasuke-data:/data alpine sh
   ```

   コンテナ内のシェルで以下を実行する。

   ```sh
   apk add -q sqlite
   sqlite3 /data/sasuke.db
   ```

   ```sql
   UPDATE passkey SET userId = (SELECT id FROM user WHERE email = 'me@example.com')
     WHERE userId = (SELECT id FROM user WHERE email = 'recovery@example.com');
   DELETE FROM user WHERE email = 'recovery@example.com';
   .quit
   ```

   `exit` でコンテナを抜けて、アプリを起動する。

   ```bash
   docker compose -f compose.tunnel.yaml start app
   ```

   - Lightsail の場合は `-f compose.tunnel.yaml` を外す。ボリューム名は `docker volume ls` で確認する (`<フォルダ名>_sasuke-data`)
   - メールアドレスはアカウント作成時に小文字に揃えて保存されているので、小文字で書く
   - 作業前に DB のバックアップを取っておくこと (各デプロイ手順の「バックアップ」を参照)

4. 元のメールアドレスのアカウントに、パスキーでログインできることを確認する
