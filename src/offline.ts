export async function prepareOffline(status: (text: string) => void) {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator))
    throw Error(
      "오프라인 준비는 배포된 주소에서 지원하는 브라우저로 열어 확인해요.",
    );
  status("수업 파일을 준비하고 있어요…");
  const registration = await navigator.serviceWorker.register(
    `${import.meta.env.BASE_URL}sw.js`,
  );
  await registration.update().catch(() => {});
  const pending = registration.installing ?? registration.waiting;
  if (pending && pending.state !== "activated")
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          reject(
            Error(
              "준비 시간이 길어졌어요. 인터넷 연결을 확인하고 다시 눌러요.",
            ),
          ),
        30000,
      );
      const check = () => {
        if (pending.state === "activated") {
          clearTimeout(timeout);
          resolve();
        } else if (pending.state === "redundant") {
          clearTimeout(timeout);
          reject(Error("새 파일을 준비하지 못했어요. 연결 후 다시 눌러요."));
        }
      };
      pending.addEventListener("statechange", check);
      check();
    });
  const ready = await navigator.serviceWorker.ready;
  const worker = registration.active ?? ready.active;
  if (!worker) throw Error("앱을 한 번 새로 연 뒤 다시 준비해요.");
  return new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => {
      channel.port1.close();
      reject(Error("파일 준비를 확인하지 못했어요. 새로고침 후 다시 눌러요."));
    }, 30000);
    channel.port1.onmessage = (event) => {
      const data = event.data;
      if (data?.type === "progress")
        status(`필수 파일 ${data.done}/${data.total}개 확인 중…`);
      if (data?.type === "ready") {
        clearTimeout(timeout);
        channel.port1.close();
        status(
          `준비 완료 · 필수 파일 ${data.total}개를 확인했어요. 연결 없이 사용할 파일이 이 브라우저에 있어요.`,
        );
        resolve();
      }
      if (data?.type === "error") {
        clearTimeout(timeout);
        channel.port1.close();
        reject(
          Error(
            "일부 파일을 준비하지 못했어요. 인터넷 연결과 저장 공간을 확인하고 다시 눌러요.",
          ),
        );
      }
    };
    worker.postMessage({ type: "PREPARE_OFFLINE" }, [channel.port2]);
  });
}
