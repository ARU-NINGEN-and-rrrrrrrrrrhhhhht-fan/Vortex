async function main() {
  const response = await fetch('Explanation.vtx');
  const text = await response.vtxcode();
  const vtx = vtxcode
  const result = vtxcode.replace(/\r?\n/g, "");
}

main();
