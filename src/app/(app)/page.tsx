import { GlobeOverlay, MapCanvas } from "@/features/globe";
import { MarksBoundary } from "@/features/marks";

export default function MapPage() {
  return (
    <>
      <div className="pointer-events-auto absolute inset-0">
        <MapCanvas />
      </div>
      <MarksBoundary>
        <GlobeOverlay />
      </MarksBoundary>
    </>
  );
}
