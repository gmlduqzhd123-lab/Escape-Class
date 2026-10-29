// Local downloads and printing only; nothing leaves the device.
export function download(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function saveText(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function openPrint(html: string) {
  document.getElementById("lesson-print")?.remove();
  const frame = document.createElement("iframe");
  frame.id = "lesson-print";
  frame.title = "인쇄할 모둠 카드";
  frame.style.cssText =
    "position:fixed;left:-2000px;top:0;width:900px;height:900px;border:0";
  frame.onload = () => {
    frame.contentWindow?.addEventListener("afterprint", () => frame.remove(), {
      once: true,
    });
    frame.contentWindow?.print();
  };
  frame.srcdoc = html;
  document.body.append(frame);
}
