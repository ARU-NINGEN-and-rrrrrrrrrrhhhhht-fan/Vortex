async function main() {
  const response = await fetch('Explanation.vtx');
  const text = await response.vtxcode();
  console.log(text);
  const vtx = vtxcode
  const result = vtx.replace(/\r?\n/g, "");
}

main();
