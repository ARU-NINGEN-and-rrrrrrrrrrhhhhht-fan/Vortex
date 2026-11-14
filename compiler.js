function compileVortexToJS(vortexCode) {
    // 1. コメント（// から行末まで）をすべて削除
    let code = vortexCode.replace(/\/\/.*$/gm, '');

    let jsOutput = '';
    let elementCount = 0; // 生成するHTML要素の変数名を被らないようにするための連番

    // 2. ブロック定義（.ブロック名. 〜 ^ブロック名）を抽出してJSの関数に変換
    code = code.replace(/\.([a-zA-Z0-9_]+)\.([\s\S]*?)\^\1/g, (match, funcName, body) => {
        const compiledBody = parseStatements(body);
        return `function ${funcName}() {\n${compiledBody}}\n`;
    });

    // 3. ブロックの外にある文（play(main); など）を処理
    jsOutput += parseStatements(code);

    // ブロック内の各命令をJSに変換する内部関数
    function parseStatements(blockText) {
        let result = '';
        let cursor = 0;

        while (cursor < blockText.length) {
            // 空白や改行を読み飛ばす
            while (cursor < blockText.length && /\s/.test(blockText[cursor])) {
                cursor++;
            }
            if (cursor >= blockText.length) break;

            // すでに変換済みの function 定義はそのまま出力へ回す
            if (blockText.startsWith('function ', cursor)) {
                const funcEnd = blockText.indexOf('}\n', cursor);
                if (funcEnd !== -1) {
                    result += blockText.slice(cursor, funcEnd + 2);
                    cursor = funcEnd + 2;
                    continue;
                }
            }

            // 命令名と (...) の引数を読み取る
            const cmdMatch = blockText.slice(cursor).match(/^([a-zA-Z0-9_]+)\s*\(([^)]*)\)/);
            if (!cmdMatch) {
                cursor++; // 解釈できない文字があれば1文字進める
                continue;
            }

            const cmdName = cmdMatch[1];
            const arg = cmdMatch[2].trim();
            cursor += cmdMatch[0].length;

            // 引数の後ろの空白を読み飛ばす
            while (cursor < blockText.length && /\s/.test(blockText[cursor])) {
                cursor++;
            }

            // パターンA: { ... } の修飾ブロックが続く場合（Textなど）
            if (blockText[cursor] === '{') {
                const closeBrace = blockText.indexOf('}', cursor);
                if (closeBrace === -1) {
                    throw new Error(`構文エラー: ${cmdName} の閉じ括弧 '}' がありません`);
                }
                const styleContent = blockText.slice(cursor + 1, closeBrace);
                cursor = closeBrace + 1;

                // 閉じ括弧の後ろの空白とセミコロンを処理
                while (cursor < blockText.length && /\s/.test(blockText[cursor])) cursor++;
                if (blockText[cursor] === ';') cursor++;

                if (cmdName === 'Text') {
                    result += generateTextJS(arg, styleContent);
                }

            // パターンB: セミコロン ; で終わる単発の命令（BackgroundColor, playなど）
            } else if (blockText[cursor] === ';') {
                cursor++; // ';' を消費

                if (cmdName === 'BackgroundColor') {
                    result += `  document.body.style.backgroundColor = "${arg}";\n`;
                } else if (cmdName === 'play') {
                    result += `${arg}();\n`;
                } else if (cmdName === 'Text') {
                    result += generateTextJS(arg, '');
                }
            } else {
                throw new Error(`構文エラー: ${cmdName} の後ろにセミコロン ';' が必要です`);
            }
        }
        return result;
    }

    // Text(...) { ... } をDOM生成のJSコードに変換するヘルパー関数
    function generateTextJS(text, styleBlock) {
        elementCount++;
        const varName = `vtx_el_${elementCount}`;
        const escapedText = text.replace(/"/g, '\\"');

        let js = `  const ${varName} = document.createElement('div');\n`;
        js += `  ${varName}.textContent = "${escapedText}";\n`;

        // { ... } の中身をセミコロンで分割してスタイルを適用
        const styles = styleBlock.split(';').map(s => s.trim()).filter(s => s.length > 0);
        for (const style of styles) {
            const colonIndex = style.indexOf(':');
            if (colonIndex === -1) continue;

            const prop = style.slice(0, colonIndex).trim();
            const val = style.slice(colonIndex + 1).trim();

            if (prop === 'Color') {
                js += `  ${varName}.style.color = "${val}";\n`;
            } else if (prop === 'Font') {
                const escapedFont = val.replace(/"/g, '\\"');
                js += `  ${varName}.style.fontFamily = "${escapedFont}";\n`;
            } else if (prop === 'Size') {
                js += `  ${varName}.style.fontSize = "${val}";\n`;
            } else if (prop === 'Bold') {
                js += `  ${varName}.style.fontWeight = "${val === '1' ? 'bold' : 'normal'}";\n`;
            }
        }

        js += `  document.body.appendChild(${varName});\n`;
        return js;
    }

    return jsOutput;
}

// ==========================================
// ファイル選択（<input type="file">）との連携処理
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('vtxFile');
    if (!fileInput) return;

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const vortexCode = e.target.result;
            try {
                console.log("--- 読み込んだ Vortex コード ---");
                console.log(vortexCode);

                // コンパイル実行
                const generatedJS = compileVortexToJS(vortexCode);
                console.log("--- 変換された JavaScript ---");
                console.log(generatedJS);

                // ブラウザ上で実行
                new Function(generatedJS)();
            } catch (err) {
                alert("コンパイルエラー: " + err.message);
                console.error(err);
            }
        };
        reader.readAsText(file);
    });
});
