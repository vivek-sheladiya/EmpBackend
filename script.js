async function startScreenCapture() {
  try {
    let stream = await navigator.mediaDevices.getDisplayMedia({
      audio: false,
      video: true,
    });

    const mainDiv = document.createElement("div");

    mainDiv.style.width = "220px";
    mainDiv.style.height = "130px";
    mainDiv.style.borderRadius = "10px";
    mainDiv.style.display = "flex";
    mainDiv.style.justifyContent = "center";
    mainDiv.style.alignItems = "center";
    mainDiv.style.backgroundColor = "white";

    const innerDiv = document.createElement("div");

    innerDiv.style.width = "216px";
    innerDiv.style.height = "126px";
    innerDiv.style.borderRadius = "10px";
    innerDiv.style.position = "absolute";
    innerDiv.style.backgroundColor = "lightgrey";

    mainDiv.appendChild(innerDiv);

    const videoElement = document.createElement("video");
    videoElement.srcObject = stream;
    videoElement.play();

    videoElement.onloadeddata = () => {
      const canvas = document.createElement("canvas");
      const canvasMain = document.createElement("canvas");
      canvasMain.width = videoElement.videoWidth;
      canvasMain.height = videoElement.videoHeight;
      canvas.width = 216;
      canvas.height = 126;

      const context = canvas.getContext("2d");
      const contextMain = canvasMain.getContext("2d");

      const capturedImage = document.createElement("img");
      context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      contextMain.drawImage(
        videoElement,
        0,
        0,
        canvasMain.width,
        canvasMain.height
      );
      const dataUrl = canvas.toDataURL("image/png");
      const dataUrlMain = canvasMain.toDataURL("image/png");
      capturedImage.src = dataUrl;

      capturedImage.style.borderRadius = "10px";
      capturedImage.style.display = "block";
      capturedImage.setAttribute("draggable", "false");

      capturedImage.addEventListener("contextmenu", (e) => {
        e.preventDefault();
      });

      capturedImage.style.userSelect = "none";
      capturedImage.style.userDrag = "none";
      capturedImage.style.webkitUserDrag = "none";
      capturedImage.style.pointerEvents = "none";

      let startValue = 0;
      let endValue = Number(100);
      let duration = 5;
      let speed = (duration * 1000) / (endValue * 10);
      let progressColor = "#22fd1a";

      const progress = setInterval(() => {
        startValue += 0.1;

        mainDiv.style.background = `conic-gradient(${progressColor} ${
          startValue * 3.6
        }deg,#ffffff 0deg)`;

        if (startValue >= endValue) {
          clearInterval(progress);
        }
      }, speed);

      innerDiv.appendChild(capturedImage);
      document.body.appendChild(mainDiv);
    };
  } catch (error) {
    console.error("Error capturing screen:", error);
  }
}

window.onload = startScreenCapture;
