# 掼蛋提升

完整掼蛋对战 Web App。前端使用 React + TypeScript + Vite，后端使用 Express 调 DeepSeek API，规则判断放在共享模块中，AI 只能从合法出牌里选择。

## 功能

- 四人 2v2 掼蛋，玩家坐南，北家为队友，东/西为对手。
- 支持两副牌 108 张、当前级牌、红桃级牌逢人配。
- 支持单张、对子、三张、三带二、顺子、连对、钢板、炸弹、同花顺、王炸。
- 支持出牌合法性判断、压牌比较、不出、提示、AI 自动行动。
- 支持头游/二游/三游/末游结算、升级、下一局自动进贡/还贡/抗贡。
- 支持战绩统计、规则页、设置页。
- DeepSeek 未配置或请求失败时，自动使用本地兜底 AI。

## 本地运行

```bash
npm install
cp .env.example .env
npm run dev
```

前端地址：

```text
http://127.0.0.1:5173
```

后端地址：

```text
http://127.0.0.1:8787
```

## DeepSeek 配置

在 `.env` 中配置：

```bash
DEEPSEEK_API_KEY=你的 key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
PORT=8787
```

不要把 `.env` 提交到 GitHub。项目已经在 `.gitignore` 中忽略 `.env`。

## 在线访问

GitHub Pages 部署后可直接打开：

```text
https://wangyimin-afk.github.io/guandan-practice/
```

在线版本不包含 Express 后端，也不会暴露 DeepSeek API Key。未连接后端时，机器人会自动使用前端本地 AI 策略。

## 验证

```bash
npm test
npm run build
```

## GitHub 上传

当前仓库已经配置远程：

```text
https://github.com/wangyimin-afk/guandan-practice.git
```

常规流程：

```bash
git status
git add .
git commit -m "Build full Guandan game app"
git push
```

如果要走 Pull Request，建议从 `main` 新建功能分支再推送。
