const API = "https://xhmd.onrender.com";

let template = "";
let selectedM3U8 = "";
let videoId = "";

async function load() {
    const url = document.getElementById("url").value;

    if (!url) return alert("URLを入力してください");

    showLoading(true);
    document.getElementById("result").classList.add("hidden");

    try {
        const data = await fetch(`${API}/video-info?url=${encodeURIComponent(url)}`)
            .then(r => r.json());

        template = data.template;
        videoId = data.id;

        const select = document.getElementById("quality");
        select.innerHTML = "";

        data.resolutions.forEach(r => {
            const option = document.createElement("option");
            option.value = r;
            option.textContent = r;
            select.appendChild(option);
        });

        document.getElementById("result").classList.remove("hidden");
    } catch (error) {
        console.error(error);
        alert("解析に失敗しました");
    } finally {
        showLoading(false);
    }
}

function createFilename(id, resolution) {
    return `${id}_${resolution}.mp4`;
}

async function download() {
    showLoading(true);
    
    const res = document.getElementById("quality").value;
    const m3u8Url = template.replace("_TPL_", res);

    const { init, segments } = await parseM3U8(m3u8Url);

    const urls = init ? [init, ...segments] : segments;

    const filename = createFilename(videoId, res);

    await downloadSegments(urls, filename);

    showLoading(false);
}

async function parseM3U8(url) {
    const text = await fetchWithFallback(url).then(r => r.text());
    const lines = text.split("\n");

    let init = null;
    const segments = [];

    for (const line of lines) {
        if (line.startsWith("#EXT-X-MAP")) {
            const match = line.match(/URI="([^"]+)"/);
            if (match) {
                init = new URL(match[1], url).href;
            }
        } else if (line && !line.startsWith("#")) {
            segments.push(new URL(line, url).href);
        }
    }

    return { init, segments };
}

async function fetchWithFallback(url) {
    try {
        return await fetch(url);
    } catch {
        return fetch(`${API}/proxy?url=${encodeURIComponent(url)}`);
    }
}

async function downloadSegments(urls, filename) {
    const stream = new ReadableStream({
        async start(controller) {
            for (const url of urls) {
                const res = await fetchWithFallback(url);
                const reader = res.body.getReader();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    controller.enqueue(value);
                }
            }
            controller.close();
        }
    });

    const blob = await new Response(stream).blob();

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
}

function showLoading(show) {
    document.getElementById("loading").classList.toggle("hidden", !show);
    document.getElementById("analyzeBtn").disabled = show;
}