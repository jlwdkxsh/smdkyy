# 记录自己

只在这台电脑上运行的小应用：记录身体状态、精力、心情，记大事件，按天回看。

## 怎么用

1. 双击 **`启动.bat`**。
2. 会弹出一个小黑窗口，同时浏览器自动打开应用。
3. 用完把小黑窗口关掉即可；数据已经保存，不会丢。
4. 下次要用，再双击 `启动.bat`。

不需要联网、不需要登录、不需要安装任何东西。

## 数据在哪

- 全部数据：`D:\jlrc\data\data.json`（记录、大事件、10 档表情图与颜色都在这个文件里）
- 自动备份：`D:\jlrc\data\backup\`（导入前自动生成，保留最近 10 份）

想手动备份，直接把 `data.json` 复制到别的地方即可；也可以在「设置 → 数据」里点「导出备份」。

## 目录结构

```
jlrc/
  启动.bat          双击启动
  server.mjs        本地服务（静态文件 + 数据读写）
  runtime/node.exe  随包附带的 Node 运行时
  app/              网页本体
    index.html
    styles.css
    js/model.mjs    数据模型（纯函数）
    js/chart.mjs    单日折线图
    js/ring.mjs     日历圆环
    js/view.mjs     页面渲染
    js/app.mjs      浏览器端逻辑
  data/             数据文件与备份
  tests/            测试
  PRD.md            需求文档
```

## 开发与测试

在 `D:\jlrc` 下执行：

```
runtime\node.exe --test --test-isolation=none "tests/*.test.mjs"
```

或 `runtime\node.exe server.mjs --port 4173` 直接起服务调试。

## 手机端（Android）

安装包：`dist\jilu-ziji-1.0.0-debug.apk`（约 4.3MB，debug 签名，可直接安装）。

安装步骤：

1. 把 APK 传到手机（数据线、微信文件传输助手、网盘都行）
2. 在手机上点开安装，允许“安装未知来源应用”
3. 桌面出现「记录自己」图标，点开即用，完全离线

手机版数据存在 App 内部的 IndexedDB，和电脑版互不影响。

- 迁移已有记录：电脑「设置 → 导出记录」→ 把 JSON 传到手机 → 手机「设置 → 导入记录」
- 颜色、10 档表情图、背景需要在手机上重新设置（导出本来就不含外观）
- **卸载 App 会清掉手机上的数据**；覆盖安装（装新版本）不会

### 重新打包 APK

需要 JDK 21、Android SDK（platform 36 / build-tools 36）、Gradle 8.14.3。本机已装好：

- JDK：`%LOCALAPPDATA%\Programs\jlrc-tools\jdk-21.0.13.1+2`
- Gradle：`%LOCALAPPDATA%\Programs\jlrc-tools\gradle-8.14.3`
- Android SDK：`%LOCALAPPDATA%\Android\Sdk`

在项目根目录执行：

```
node node_modules\@capacitor\cli\bin\capacitor sync android
```

然后在 `android` 目录，设置好 `JAVA_HOME` 和 `ANDROID_HOME` 后执行：

```
%LOCALAPPDATA%\Programs\jlrc-tools\gradle-8.14.3\bin\gradle.bat assembleDebug
```

产物：`android\app\build\outputs\apk\debug\app-debug.apk`

## 注意

- 请固定用同一个浏览器（Chrome 或 Edge）打开，数据在磁盘上，换浏览器不影响。
- 不要删除 `data` 文件夹，那是唯一的记录。
- 清除浏览器缓存、重装浏览器都不会影响数据。
- 手机端是 debug 签名，只适合自己安装，不要发到应用商店。
