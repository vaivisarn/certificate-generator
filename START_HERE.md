# START HERE

This folder will become the certificate generator app. Right now it holds 2 files:

- `CLAUDE.md`, the full spec. Claude Code reads it automatically.
- `START_HERE.md`, this file, the setup steps.

Total setup time is about 15 minutes. Do the steps in order.

---

## Step 1. Install Node.js

Node runs the build tools and the local preview server.

1. Go to nodejs.org and download the **LTS** installer for macOS.
2. Double click it and accept the defaults.
3. Open Terminal (Spotlight, type Terminal) and check it worked:

```bash
node -v
```

You should see something like `v22.x.x`.

## Step 2. Install git

git is the version control system. macOS ships a stub that offers to install it.

```bash
git --version
```

If a dialog appears, click Install and wait. Then run the command again to confirm.

Tell git who you are (once per machine):

```bash
git config --global user.name "Vaivisarn Bunjaroen"
git config --global user.email "vaivisarn@gmail.com"
```

## Step 3. Install Claude Code

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

Then close Terminal, open it again, and check:

```bash
claude --version
```

Claude Code needs a Claude Pro, Max, Team or Enterprise account. The free plan does not include it.

## Step 4. Open the project and start Claude Code

```bash
cd /Users/tk/Desktop/81_App_Certificates
claude
```

The first run opens a browser to log in. After that you get a prompt in the Terminal.

## Step 5. Paste the kickoff prompt

Copy this into Claude Code as your first message:

```text
Read CLAUDE.md in this folder. It is the agreed spec for v0.1 of a certificate
generator web app.

Follow my plan first rule: show me a numbered build plan and wait for my approval
before you execute anything.

After I approve, scaffold the Vite + React + TypeScript project in this folder,
run git init, and build the app in the order given in section 10 of the spec,
with a commit after each step. Set up the GitHub Actions workflow for GitHub Pages
early so deployment is never a surprise at the end.

Stop and show me the result after each numbered step so I can follow along.
```

---

## After v0.1 runs on your machine

Preview it locally at any time:

```bash
npm run dev
```

Then publish:

1. Go to github.com/new and create an empty **public** repo named `certificate-generator`. Do not add a README, the project already has one.
2. Back in Terminal, in the project folder:

```bash
git remote add origin https://github.com/vaivisarn/certificate-generator.git
git branch -M main
git push -u origin main
```

3. On GitHub: Settings > Pages > Source: **GitHub Actions**.
4. Wait about 2 minutes. The site goes live at:

```
https://vaivisarn.github.io/certificate-generator/
```

From then on, every `git push` to `main` updates the live site automatically.

## Day to day loop

```
edit with Claude Code  ->  npm run dev to check  ->  git commit  ->  git push  ->  live site updates
```

Team comments become GitHub Issues. One branch per issue, merge when it works.

## If something goes wrong

- `claude doctor` checks the Claude Code install.
- Ask Claude Code in plain words. Paste the error message, it reads the whole project.
- Nothing here is fragile. Everything is in git, so a bad change can always be undone.

---

## สรุปภาษาไทย

1. ติดตั้ง Node.js (ตัว LTS จาก nodejs.org) และ git แล้วเช็กด้วย `node -v` กับ `git --version`
2. ติดตั้ง Claude Code ด้วยคำสั่ง `curl -fsSL https://claude.ai/install.sh | bash` (ต้องมีบัญชี Pro, Max, Team หรือ Enterprise)
3. เปิด Terminal แล้วพิมพ์ `cd /Users/tk/Desktop/81_App_Certificates` ตามด้วย `claude`
4. วางข้อความ kickoff prompt ในขั้นตอนที่ 5 ด้านบน Claude Code จะเสนอแผนก่อน แล้วรออนุมัติจากเรา
5. พอ v0.1 ใช้งานได้แล้ว สร้าง repo สาธารณะชื่อ `certificate-generator` บน GitHub แล้ว push ขึ้นไป เปิด GitHub Pages เว็บจะขึ้นออนไลน์อัตโนมัติทุกครั้งที่ push

ไฟล์ `CLAUDE.md` คือสเปกทั้งหมดที่ตกลงกันไว้ ไม่ต้องอธิบายซ้ำ Claude Code อ่านเองอัตโนมัติ
