import { Composition } from "remotion";
import { SwasthyaScoreLandingVideo } from "./SwasthyaScoreLandingVideo";

export function RemotionRoot() {
  return (
    <Composition
      id="SwasthyaScoreLandingVideo"
      component={SwasthyaScoreLandingVideo}
      durationInFrames={1080}
      fps={30}
      width={1920}
      height={1080}
    />
  );
}
