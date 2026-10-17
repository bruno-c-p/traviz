import { GlobeOverlay, MapCanvas } from "@/features/globe";

export default function MapPage() {
  return (
    <>
      <div className="pointer-events-auto absolute inset-0">
        <MapCanvas />
      </div>
      <GlobeOverlay />
    </>
  );
}
