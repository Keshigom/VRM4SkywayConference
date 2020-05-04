/*!
pixiv/three-vrm

Copyright (c) 2019 pixiv Inc.
Code released under the MIT license
https://github.com/pixiv/three-vrm/blob/dev/LICENSE
*/

/*!
jeelizWeboji

Copyright (c) Jeeliz
Code released under the Apache License 2.0
https://github.com/jeeliz/jeelizWeboji/blob/master/LICENSE
*/

/*!
skyway-conf

Copyright (c) Jeeliz
Copyright (c) 2020 NTT Communications Corp.
https://github.com/skyway/skyway-conf/blob/master/LICENSE
*/

import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRM, VRMSchema } from '@pixiv/three-vrm';
import * as SETTINGS from './settings.json';

interface CanvasElement extends HTMLCanvasElement {
    captureStream(): MediaStream;
}

// == レンダラーを作成 =========================================================================================
const renderer = new THREE.WebGLRenderer({
    preserveDrawingBuffer: false,
    antialias: true,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(SETTINGS.canvas.width, SETTINGS.canvas.height);
renderer.setClearColor("#0181DB");

export const threeCanvas: CanvasElement = renderer.domElement as unknown as CanvasElement;


// == シーンを作成 =========================================================================================
const threeScene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, SETTINGS.canvas.width / SETTINGS.canvas.height);
camera.position.set(0, 1.4, -0.8);
camera.rotation.set(0, Math.PI, 0);

const light = new THREE.DirectionalLight(0xffffff);
threeScene.add(light);


// == VRM インポート =========================================================================================

const loadGLTF = async (url: string): Promise<GLTF> => {
    const loader = new GLTFLoader();
    return new Promise<GLTF>((resolve, reject) => {
        loader.load(
            url,
            (gltf) => {

                resolve(gltf);
            },
            (progress) => {


                console.log('Loading model...', 100.0 * (progress.loaded / progress.total), '%');
            },
            (err) => { reject(err); }
        )
    });
}

const loadVRM = async (gltf: GLTF): Promise<VRM> => {
    return await VRM.from(gltf);
}

let currentVRM: VRM;
export const loadAvatar = async (url: string) => {
    const gltf = await loadGLTF(url);
    const vrm = await loadVRM(gltf);
    if (currentVRM) {
        threeScene.remove(currentVRM.scene);
    }
    threeScene.add(vrm.scene);

    setUpVRM(vrm);
    currentVRM = vrm;
}

let bones: {
    [s: string]: THREE.Object3D | null | undefined;
};
const setUpVRM = (vrm: VRM): void => {
    if (!vrm.humanoid) {
        console.error("this model is not humanoid");
        return;
    }

    bones = {
        "head": vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Head) || null,
        "neck": vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Neck) || null,
        "spine": vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Spine) || null,
        "leftUpperArm": vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.LeftUpperArm) || null,
        "rightUpperArm": vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.RightUpperArm) || null,
    };

    // カメラを頭部位置へあわせる
    if (bones.head) {
        const headPos = bones.head.getWorldPosition(new THREE.Vector3);
        camera.position.y = headPos.y || camera.position.y;
    }

    // カメラ目線
    if (vrm.lookAt) {
        vrm.lookAt.target = camera;
    }

    // 腕を下ろす
    const armRotation = Math.PI * (-70 / 180);
    if (bones.leftUpperArm) {
        bones.leftUpperArm.rotation.z = -armRotation;
    }
    if (bones.rightUpperArm) {
        bones.rightUpperArm.rotation.z = armRotation;
    }
}

// デフォルトモデル
loadAvatar('/models/three-vrm-girl.vrm');


// == jeeliz =========================================================================================
const jeelizCanvas: HTMLCanvasElement = document.createElement("canvas");
jeelizCanvas.id = "jeelizCanvas";
document.body.appendChild(jeelizCanvas).style.display = "none";

const faceTransferAPI = require("./jeeliz/jeelizFaceTransferES6.js");
const neuralNetworkModel = require('./jeeliz/jeelizFaceTransferNNC.json');
export const initFaceDetection = (deviceId: string) => {

    if (currentReqID) {
        cancelAnimationFrame(currentReqID);
    }
    update();


    faceTransferAPI.init({
        canvasId: "jeelizCanvas",
        NNC: neuralNetworkModel, //instead of NNCpath
        //... other init parameters
        videoSettings: {
            // 'videoElement'//not set by default. <video> element used
            //If you specify this parameter,
            //all other settings will be useless
            //it means that you fully handle the video aspect

            'deviceId': deviceId,      //not set by default
            'facingMode': 'user', //to use the rear camera, set to 'environment'
            'idealWidth': 800,  //ideal video width in pixels
            'idealHeight': 600, //ideal video height in pixels
            'minWidth': 480,    //min video width in pixels
            'maxWidth': 1280,   //max video width in pixels
            'minHeight': 480,   //min video height in pixels
            'maxHeight': 1280,  //max video height in pixels,
            'rotate': 0,        //rotation in degrees possible values: 0,90,-90,180
            'flipX': false      //if we should flip horizontally the video. Default: false
        },
        callbackReady: (errCode: any) => {
            if (errCode) {
                console.log('AN ERROR HAPPENS. ERROR CODE =', errCode);
                return;
            }
            faceTransferAPI.switch_displayVideo(false);
            console.log("Jeeliz is Ready");
        },
    });
}

const applyHeadRotation = (rotaions: Array<number>) => {

    let xd = -1, yd = 1, zd = -1;
    if (SETTINGS.isMirror) {
        yd = -1;
        zd = 1;
    }

    let faceRotaion = [
        SETTINGS.headOffset.x + xd * rotaions[0],
        SETTINGS.headOffset.y + yd * rotaions[1],
        SETTINGS.headOffset.z + zd * rotaions[2]
    ];


    const headW = 0.7;
    const neckW = 0.2;
    const spineW = 0.1;
    if (bones.head) {
        bones.head.rotation.x = faceRotaion[0] * headW;
        bones.head.rotation.y = faceRotaion[1] * headW;
        bones.head.rotation.z = faceRotaion[2] * headW;
    }
    if (bones.neck) {
        bones.neck.rotation.x = faceRotaion[0] * neckW;
        bones.neck.rotation.y = faceRotaion[1] * neckW;
        bones.neck.rotation.z = faceRotaion[2] * neckW;
    }
    if (bones.spine) {
        bones.spine.rotation.x = faceRotaion[0] * spineW;
        bones.spine.rotation.y = faceRotaion[1] * spineW;
        bones.spine.rotation.z = faceRotaion[2] * spineW;
    }
}


// //jeelizの表情データをVRM用に変換する。
interface FaceBlendshape {
    [s: string]: number;
};
const convertExpression = (faceExpression: any): FaceBlendshape => {

    const rawExpressions: FaceBlendshape = {
        "blink_r": faceExpression[SETTINGS.isMirror ? 8 : 9] || 0,
        "blink_l": faceExpression[SETTINGS.isMirror ? 9 : 8] || 0,
        "a": faceExpression[6] || 0,
        "i": faceExpression[10] || 0,
        "u": faceExpression[7] || 0,
        "o": (faceExpression[6] + faceExpression[6] * faceExpression[7]) * 0.5 || 0,
    };
    return rawExpressions;
}

// リップシンクの排他制御を行う 
// TODO:入力データに閾値を適用する。
const applyThreshold = (rawExpressions: FaceBlendshape): FaceBlendshape => {

    let max = 0;
    const ripKey = ['a', 'i', 'u', 'e', 'o'];


    ripKey.forEach(key => {
        if (rawExpressions[key]) {
            if (rawExpressions[key] > max) {
                max = rawExpressions[key];
            } else {
                rawExpressions[key] = 0;
            }
        }
    });

    return rawExpressions;
}

// //表情状態をモデルに適用する。
const applyExpression = (filteredExpressions: any): void => {
    if (currentVRM.blendShapeProxy) {

        currentVRM.blendShapeProxy.setValue("blink_r", filteredExpressions["blink_r"]);
        currentVRM.blendShapeProxy.setValue("blink_l", filteredExpressions["blink_l"]);
        currentVRM.blendShapeProxy.setValue("a", filteredExpressions["a"]);
        currentVRM.blendShapeProxy.setValue("i", filteredExpressions["i"]);
        currentVRM.blendShapeProxy.setValue("u", filteredExpressions["u"]);
        currentVRM.blendShapeProxy.setValue("o", filteredExpressions["o"]);
    }
}


const faceDetection = () => {
    if (faceTransferAPI.ready) {

        if (faceTransferAPI.is_detected()) {

            const faceRotaion = faceTransferAPI.get_rotationStabilized();
            const faceExpression = faceTransferAPI.get_morphTargetInfluencesStabilized();

            //頭の向きの追従
            applyHeadRotation(faceRotaion);

            //表情
            const rawExpressions = convertExpression(faceExpression);
            const filteredExpressions = applyThreshold(rawExpressions);
            applyExpression(filteredExpressions);
        }

    }
}



// コピー用のキャンバス
export const drawCanvas: CanvasElement = document.createElement("canvas") as unknown as CanvasElement;
drawCanvas.width = SETTINGS.canvas.width;
drawCanvas.height = SETTINGS.canvas.height;

const updateImgage = async () => {
    drawCanvas.getContext('2d')!.drawImage(threeCanvas, 0, 0);
}

// == 描画ループ =========================================================================================
const clock = new THREE.Clock();
let currentReqID: number;
const update = () => {
    const delta = clock.getDelta();
    if (currentVRM) {
        faceDetection();
        currentVRM.update(delta);
    }

    renderer.render(threeScene, camera);
    updateImgage();
    currentReqID = requestAnimationFrame(update);
}
