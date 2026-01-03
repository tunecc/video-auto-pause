// ==UserScript==
// @name         Auto Pause Background Video
// @namespace    https://github.com/tunecc/video-auto-pause
// @version      1.1
// @description  [ZH] 仅允许当前有焦点的页面继续播放 Bilibili / YouTube 视频，自动暂停其他后台或失焦标签页，防止刷新或切换窗口抢占播放。
// @description:en  Only allow the focused tab to keep playing videos on Bilibili / YouTube. Automatically pauses videos in background or unfocused tabs to prevent playback hijacking.
// @author       Tune (tunecc)
// @homepage     https://github.com/tunecc/video-auto-pause
// @source       https://github.com/tunecc/video-auto-pause
// @downloadURL  https://raw.githubusercontent.com/tunecc/video-auto-pause/refs/heads/main/video-auto-pause.user.js
// @downloadURL  https://raw.githubusercontent.com/tunecc/video-auto-pause/refs/heads/main/video-auto-pause.user.js
// @match        https://*.bilibili.com/*
// @match        https://*.youtube.com/*
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @run-at       document-start
// @license      MIT
// @icon         https://raw.githubusercontent.com/tunecc/video-auto-pause/master/logo.png
// ==/UserScript==

(function() {
    'use strict';

    // --- 全局配置 ---
    const SCRIPT_ID = `${Date.now()}-${Math.random()}`;
    const GM_CHANNEL_KEY = 'universalVideoControlChannel';
    const SEEK_TOLERANCE_MS = 2000; // 容错时间：如果在2秒内视频有过播放进度更新，则认为是连续播放

    let currentVideo = null;
    let lastActiveTime = 0; // 记录上一次视频“活着”的时间

    // --- 辅助函数 ---
    function waitForElement(selector, callback) {
        const element = document.querySelector(selector);
        if (element) { callback(element); return; }
        const observer = new MutationObserver((mutations, obs) => {
            const el = document.querySelector(selector);
            if (el) { obs.disconnect(); callback(el); }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    // --- 核心逻辑 ---

    /**
     * 当视频尝试播放时触发
     */
    function onPlay() {
        const video = this;
        const now = Date.now();

        // 1. 【后台完全隐藏】
        // 如果页面最小化或完全不可见，无论如何都要暂停
        if (document.visibilityState !== 'visible') {
            video.pause();
            return;
        }

        // 2. 【检查焦点与连续性】
        if (!document.hasFocus()) {
            // 核心修复逻辑：
            // 检查这个视频是不是“刚才还在播”？
            // SponsorBlock 跳过广告时，虽然触发了 play，但几毫秒前视频还在走 (timeupdate)。
            // 只有当视频“很久没动过”（比如刚刷新页面，或者暂停了很久），才会被判定为自动播放干扰。
            const isJustPlaying = (now - lastActiveTime < SEEK_TOLERANCE_MS);

            if (isJustPlaying) {
                // 这是“跳转”或“空降”，允许它继续播，不要打断。
                // 并且也不需要广播“play_started”，因为它本来就是播放状态的延续。
                // console.log('SponsorBlock/Seek detected, allowing playback without focus.');
                return;
            } else {
                // 这是“冷启动”（刷新页面或从暂停态启动），且没有焦点 -> 判定为后台干扰，杀！
                // console.log('Background cold start detected. Pausing.');
                if (!video.paused) {
                    video.pause();
                }
                return;
            }
        }

        // 3. 【正常播放】
        // 有焦点，且是主动播放 -> 广播通知其他窗口暂停
        GM_setValue(GM_CHANNEL_KEY, {
            sender: SCRIPT_ID,
            action: 'play_started',
            timestamp: now
        });
    }

    /**
     * 记录视频活跃时间
     * 只要视频在走，就不断刷新这个时间戳
     */
    function onTimeUpdate() {
        lastActiveTime = Date.now();
    }

    /**
     * 接收广播
     */
    function onMessage(name, oldValue, newValue, remote) {
        if (!remote || !newValue || newValue.sender === SCRIPT_ID) return;

        if (newValue.action === 'play_started') {
            // 如果我有焦点，我是老大，不听指挥
            if (document.hasFocus()) return;

            // 别人开始了，我暂停
            if (currentVideo && !currentVideo.paused) {
                currentVideo.pause();
            }
        }
    }

    /**
     * 绑定视频事件
     */
    function setupVideo(videoElement) {
        if (videoElement === currentVideo) return;

        if (currentVideo) {
            currentVideo.removeEventListener('play', onPlay);
            currentVideo.removeEventListener('playing', onPlay);
            currentVideo.removeEventListener('timeupdate', onTimeUpdate); // 移除旧监听
        }

        currentVideo = videoElement;

        if (currentVideo) {
            currentVideo.addEventListener('play', onPlay);
            currentVideo.addEventListener('playing', onPlay);
            currentVideo.addEventListener('timeupdate', onTimeUpdate); // 新增监听：记录存活心跳
        }
    }

    // --- 网站适配层 ---
    const siteAdapters = {
        'bilibili.com': { playerContainerSelector: '#bilibili-player' },
        'youtube.com': { playerContainerSelector: '#movie_player' }
    };

    function initialize() {
        const currentHostname = window.location.hostname;
        const adapterKey = Object.keys(siteAdapters).find(key => currentHostname.includes(key));
        if (!adapterKey) return;

        const adapter = siteAdapters[adapterKey];

        waitForElement(adapter.playerContainerSelector, (playerContainer) => {
            const videoObserver = new MutationObserver(() => {
                const video = playerContainer.querySelector('video');
                if (video) setupVideo(video);
            });
            videoObserver.observe(playerContainer, { childList: true, subtree: true });

            const initialVideo = playerContainer.querySelector('video');
            if (initialVideo) setupVideo(initialVideo);
        });

        GM_addValueChangeListener(GM_CHANNEL_KEY, onMessage);
    }

    initialize();
})();