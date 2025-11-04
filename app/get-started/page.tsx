import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GetStartedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="mx-auto w-full max-w-md space-y-6 p-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Get Started with MindMesh</h1>
          <p className="text-muted-foreground">
            Create your account and start organizing your second brain
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm space-y-4">
          <p className="text-sm text-muted-foreground text-center">
          </p>
          <div className="flex justify-center">
            <Button asChild variant="outline">
              <Link href="/sign-in">Already have an account? Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
