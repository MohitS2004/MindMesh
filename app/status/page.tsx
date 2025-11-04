export default function StatusPage() {
  return (
    <div className="container py-16">
      <h1 className="text-4xl font-bold mb-4">System Status</h1>
      <div className="mt-8 space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-green-500"></div>
          <span>All systems operational</span>
        </div>
      </div>
    </div>
  );
}
