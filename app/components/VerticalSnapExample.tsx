// VerticalSnapExample.tsx
export default function VerticalSnapExample() {
  const items = ["Apple", "Banana", "Coconut", "Date", "Elderberry"];

  return (
    <div className="relative h-96 w-full mx-auto bg-gray-50 overflow-y-auto snap-y snap-mandatory">
      {/* Blurred fade at the top */}
      <div className="pointer-events-none absolute top-0 z-10 h-16 w-full bg-gradient-to-b from-white to-transparent" />
      {/* Blurred fade at the bottom */}
      <div className="pointer-events-none absolute bottom-0 z-10 h-16 w-full bg-gradient-to-t from-white to-transparent" />

      <div className="relative">
        {items.map((item, i) => (
          <div
            key={i}
            className="py-10 snap-center text-center text-2xl cursor-pointer"
            style={{
              scrollSnapAlign: "center",
              scrollSnapStop: "always",
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
