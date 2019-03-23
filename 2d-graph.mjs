import { Mat4, Vec4 } from "./matrix-math.mjs";

const scaledTexturedVsSource =
    `attribute vec4 aPosition;
uniform mat4 uMVPMatrix;
varying mediump vec2 vPosition;
void main(void) {
    gl_Position = uMVPMatrix * aPosition;
    vPosition = aPosition.xy;
}`;

let texturedFsSource =
    `varying mediump vec2 vPosition;
uniform sampler2D uSampler;
void main(void) {
    lowp vec4 color = texture2D(uSampler, vPosition);
    if (abs(vPosition.x) < 1.0/16.0 || abs(vPosition.y) < 1.0/16.0) {
        color = vec4(0, 0, 0, 1);
    }
    gl_FragColor = color;
}`;

const viewMatrix = new Mat4();
const perspectiveMatrix = new Mat4();
const viewPerspectiveMatrix = new Mat4();

const canvas = document.querySelector("canvas");
const gl = canvas.getContext("webgl", {
    alpha: false,
    depth: true, //needed for depth culling
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    stencil: false,
});

let shaderProgram = initShaderProgram(gl, scaledTexturedVsSource, texturedFsSource);

let programInfo = {
    program: shaderProgram,
    attribLocations: {
        position: gl.getAttribLocation(shaderProgram, 'aPosition'),
    },
    uniformLocations: {
        mvpMatrix: gl.getUniformLocation(shaderProgram, 'uMVPMatrix'),
        uSampler: gl.getUniformLocation(shaderProgram, 'uSampler'),
    },
};

const backgroundModel = initTexturedBox(gl, 0, 0, 255, 255);

loadTexture(gl, "gridcell.png");

let cameraZoomOut = 5;
const camera = [0, 0, Math.pow(2, cameraZoomOut / 4)];


gl.clearColor(0.53, 0.81, 0.92, 1);
// gl.clearColor(0x74 / 255, 0x74 / 255, 0x74 / 255, 1);
// gl.enable(gl.DEPTH_TEST);


document.body.onresize = function () {
    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientWidth * window.devicePixelRatio;

    canvas.style.height = canvas.clientWidth;
    gl.viewport(0, 0, canvas.width, canvas.height);

    const aspectRatio = canvas.clientWidth / canvas.clientHeight;
    Mat4.perspectiveMatrix(perspectiveMatrix, 90, aspectRatio, 0.5 ** 10, 2 ** 10);
};
document.body.onresize();


function loadShader(gl, type, source) {
    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.log('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function initShaderProgram(gl, vsSource, fsSource) {
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.log('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }

    return shaderProgram;
}


function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const image = new Image();
    image.src = url;

    image.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        requestAnimationFrame(drawScene);
    };

    image.onerror = function () {
        const pixel = new Uint8Array([0, 255, 255]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, pixel);

        requestAnimationFrame(drawScene);
    }

    return texture;
}


function drawScene(timestamp) {
    // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.clear(gl.COLOR_BUFFER_BIT);

    Mat4.lookAt(viewMatrix, camera, [camera[0], camera[1], 0], [0, 1, 0]);
    Mat4.multiply(viewPerspectiveMatrix, perspectiveMatrix, viewMatrix);

    gl.useProgram(programInfo.program);
    gl.enableVertexAttribArray(programInfo.attribLocations.position);

    gl.uniformMatrix4fv(programInfo.uniformLocations.mvpMatrix, false, viewPerspectiveMatrix.data);

    gl.bindBuffer(gl.ARRAY_BUFFER, backgroundModel.buffer);
    gl.vertexAttribPointer(programInfo.attribLocations.position, 2, gl.SHORT, false, 4, 0);
    gl.drawArrays(backgroundModel.mode, 0, backgroundModel.vertexCount);

    gl.disableVertexAttribArray(programInfo.attribLocations.position);

    requestAnimationFrame(drawScene);
}



let mouseInside;
{
    canvas.touchId = -1;

    canvas.onmousedown = function (event) {
        onpointerdown(event.x, event.y);
        this.down = true;
    };

    canvas.onmousemove = function (event) {
        if (this.down == true)
            onpointermove(event.x, event.y);
    };

    canvas.onmouseup = function (event) {
        onpointerup();
        this.down = false;
    };

    canvas.onmouseleave = function (event) {
        var e = event.toElement || event.relatedTarget;
        if (this.down) {
            onpointerup();
        }
        this.down = false;
        mouseInside = false;
    };

    canvas.onmouseenter = function (event) {
        mouseInside = true;
    };

    canvas.addEventListener("touchstart", function (event) {
        if (this.touchId === -1) {
            const touch = event.changedTouches[0];
            this.touchId = touch.identifier;
            onpointerdown(touch.pageX, touch.pageY);
        }
    });

    function existingTouchHandler(event) {
        event.preventDefault();

        for (const touch of event.changedTouches) {
            if (touch.identifier === this.touchId) {
                switch (event.type) {
                    case "touchmove":
                        onpointermove(touch.pageX, touch.pageY);
                        break;

                    case "touchend":
                    case "touchcancel":
                        onpointerup();
                        this.touchId = -1;
                        break;
                }
            }
        }
    }

    canvas.addEventListener("touchmove", existingTouchHandler);
    canvas.addEventListener("touchend", existingTouchHandler);
    canvas.addEventListener("touchcancel", existingTouchHandler);
}

document.onwheel = function (event) {
    if (mouseInside) {
        event.preventDefault();

        if (event.deltaY > 0) {
            ++cameraZoomOut;
        } else {
            --cameraZoomOut;
        }

        camera[2] = Math.pow(2, cameraZoomOut / 4);
    }
}

let downX, downY, isCursorDown, cameraDownX, cameraDownY;
const onpointerdown = (x, y) => {
    downX = x;
    downY = y;
    cameraDownX = camera[0];
    cameraDownY = camera[1];
    isCursorDown = true;
}

const onpointermove = (x, y) => {
    if (isCursorDown) {
        camera[0] = -(x - downX) / canvas.clientWidth * camera[2] * 3 + cameraDownX;
        camera[1] = (y - downY) / canvas.clientWidth * camera[2] * 3 + cameraDownY;
    }
}

const onpointerup = () => {
    isCursorDown = false;
}

function initTexturedBox(gl) {
    const model = new Int16Array(4 * 4);
    let i = 0;

    const min = - (2 ** 15);
    const max = 2 ** 15 - 1;

    model[i++] = max;
    model[i++] = max;

    model[i++] = min;
    model[i++] = max;

    model[i++] = max;
    model[i++] = min;

    model[i++] = min;
    model[i++] = min;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, model, gl.STATIC_DRAW);

    return { buffer, vertexCount: model.length / 4, mode: gl.TRIANGLE_STRIP };
}

export function drawGraph(equationForY) {
    equationForY = equationForY.replace("x", "vPosition.x");

    let texturedFsSource =
        `varying mediump vec2 vPosition;
    uniform sampler2D uSampler;
    void main(void) {
        mediump float ${equationForY};

        lowp vec4 color = texture2D(uSampler, vPosition);
        if (abs(vPosition.x) < 1.0/16.0 || abs(vPosition.y) < 1.0/16.0) {
            color = vec4(0, 0, 0, 1);
        }

        if (abs(vPosition.y - y) < 0.125) {
            color = vec4(0, 0, 1, 1);
        }
        gl_FragColor = color;
    }`;

    console.log(texturedFsSource);

    shaderProgram = initShaderProgram(gl, scaledTexturedVsSource, texturedFsSource);

    programInfo = {
        program: shaderProgram,
        attribLocations: {
            position: gl.getAttribLocation(shaderProgram, 'aPosition'),
        },
        uniformLocations: {
            mvpMatrix: gl.getUniformLocation(shaderProgram, 'uMVPMatrix'),
            uSampler: gl.getUniformLocation(shaderProgram, 'uSampler'),
        },
    };
}