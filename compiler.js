/**
 * VortexコードをJavaScriptコードにトランスパイル（変換）する関数
 */
function compileVortexToJS(vortexCode) {
    // 1. コメント（// から行末まで）をすべて削除
    let code = vortexCode.replace(/\/\/.*$/gm, '');

    let jsOutput = '';
    let elementCount = 0; // 生成するHTML要素の変数名を被らないようにするための連番

    // 2. ブロック定義（.ブロック名. 〜 ^ブロック名）を抽出してJSの関数に変換
    // [\s\S]*? は改行を含むすべての文字に最短マッチさせる正規表現
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

                // 閉じ括弧の後ろにセミコロンがあれば消費する
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
                    // スタイル指定なしの Text(Hello, world!); にも対応
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
        // テキスト内のダブルクォーテーションをエスケープ
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
                // 値の中のダブルクォーテーションをエスケープしてJSの文字列に入れる
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
// 動作確認テスト（先ほどのサンプルコード）
// ==========================================
const sampleVortexCode = `
.main. // mainの始まり
BackgroundColor(#000000); // 背景色を黒に設定

Text(Vortex Official Site){ // 「Vortex Official Site」を表示
  Color: #FFFFFF; // 文字色を白に指定
  Font: -apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Sans Serif", "Yu Gothic"; // フォントを指定
  Size: 30px; // サイズを30pxに指定
  Bold: 1; // 太さを指定(0ならデフォルト、1なら太字になる)
};
^main // mainの終わり

play(main); // mainを実行する
`;

// コンパイルして変換後のJSをコンソールに表示
const generatedJS = compileVortexToJS(sampleVortexCode);
console.log("--- 生成されたJavaScript ---");
console.log(generatedJS);

// ブラウザ上でそのまま実行したい場合は以下のコメントを外す
new Function(generatedJS)();
