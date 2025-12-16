# Video Focus Guard

仅允许当前有焦点的页面继续播放 Bilibili / YouTube 视频，自动暂停其他后台或失焦标签页，防止刷新或切换窗口抢占播放。

Only allow the focused tab to keep playing videos on Bilibili / YouTube. Automatically pauses videos in background or unfocused tabs to prevent playback hijacking.

## Features

- 🔍 智能识别「可见但未聚焦」的窗口：  
  - 标签页在后台或窗口最小化时，强制暂停视频；  
  - 标签页可见但窗口未获得焦点时，允许播放但**不会**向其他页面广播「暂停」信号，避免误打断正在看的窗口。

- 🎯 焦点优先  
  - 只有当前「可见且有焦点」的页面开始播放视频时，才会通知其他页面暂停。  
  - 当前窗口拥有焦点时，即使收到别的标签页的暂停信号，也会忽略，保护正在观看的播放不被抢断。

- 🌐 当前支持网站
  - Bilibili（`bilibili.com`）
  - YouTube（`youtube.com`）

## Installation

1. 安装 Tampermonkey / Violentmonkey 等用户脚本管理器。
3. [点击这里](https://raw.githubusercontent.com/tunecc/video-auto-pause/master/video-auto-pause.user.js)安装脚本。