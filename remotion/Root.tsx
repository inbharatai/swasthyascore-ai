import { Composition } from "remotion";
import { SwasthyaScoreLandingVideo } from "./SwasthyaScoreLandingVideo";

export function RemotionRoot() {
  return (
    <Composition
      id="SwasthyaScoreLandingVideo"
      component={SwasthyaScoreLandingVideo}
      durationInFrames={720}
      fps={30}
      width={1080}
      height={1920}
    />
  );
}
