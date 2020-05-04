import Peer, { SfuRoom } from "skyway-js";

export const initPeer = (forceTurn: boolean): Promise<Peer> => {
  return new Promise((resolve, reject) => {
    const peer = new Peer({
      key: "189f77ec-ed7b-4d84-97e8-8de2caa4f552",
      debug: 2,
      config: {
        iceTransportPolicy: forceTurn ? "relay" : "all",
      },
    });

    peer.once("open", () => {
      peer.removeListener("error", reject);
      resolve(peer);
    });
    // for onOpen error
    peer.once("error", reject);
  });
};

export const getPeerConnectionFromSfuRoom = (
  room: SfuRoom
): RTCPeerConnection => {
  // @ts-ignore: to get private refs
  return room._negotiator._pc;
};
