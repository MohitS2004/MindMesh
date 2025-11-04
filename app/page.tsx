import Link from "next/link";
import { Brain, FileText, CheckSquare, Upload, Bell, MessageSquare, Users, Lock } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      
      <section className="container mx-auto px-4 flex flex-col items-center justify-center gap-8 pt-24 pb-16 md:pt-32">
        <div className="flex max-w-[980px] flex-col items-center gap-4 text-center">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tighter md:text-6xl lg:text-7xl">
            Your Second Brain.{" "}
            <span className="bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Always Connected.
            </span>
          </h1>
          <p className="max-w-[750px] text-lg text-muted-foreground sm:text-xl">
            Capture notes, manage tasks, store files, and chat with AI about everything you know. 
            MindMesh keeps your knowledge organized and accessible.
          </p>
        </div>
        <div className="flex gap-4">
          <Button asChild size="lg" className="h-12 px-8">
            <Link href="/get-started">Get Started</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 px-8">
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-[980px]">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-12">
            Everything Your Brain Needs
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<FileText className="h-10 w-10" />}
              title="Notes"
              description="Capture ideas with rich text, tags, and full-text search."
            />
            <FeatureCard
              icon={<CheckSquare className="h-10 w-10" />}
              title="Tasks"
              description="Track progress with due dates, status updates, and tags."
            />
            <FeatureCard
              icon={<Upload className="h-10 w-10" />}
              title="Files & Links"
              description="Store PDFs, images, audio, video, or save links with tags."
            />
            <FeatureCard
              icon={<Bell className="h-10 w-10" />}
              title="Reminders"
              description="Never miss important deadlines with smart reminders."
            />
            <FeatureCard
              icon={<MessageSquare className="h-10 w-10" />}
              title="AI Chat"
              description="Ask questions about your data and get instant answers."
            />
            <FeatureCard
              icon={<Brain className="h-10 w-10" />}
              title="Smart Search"
              description="Find anything across all your notes, tasks, and files."
            />
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/50 py-16">
        <div className="container mx-auto px-4 max-w-[980px]">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-12">
            Built for Teams
          </h2>
          <div className="grid gap-8 sm:grid-cols-2">
            <FeatureCard
              icon={<Users className="h-10 w-10" />}
              title="Shared Organizations"
              description="Create organizations and invite team members to collaborate."
            />
            <FeatureCard
              icon={<Lock className="h-10 w-10" />}
              title="Granular Permissions"
              description="Control who can view, edit, or manage your organization's data."
            />
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-[750px] text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Your Data. Your Control.
          </h2>
          <p className="text-lg text-muted-foreground">
            All your information is encrypted and stored securely. You decide who has access, 
            and you can export or delete your data anytime.
          </p>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            <span className="font-semibold">MindMesh</span>
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/docs" className="hover:underline">Docs</Link>
            <Link href="/privacy" className="hover:underline">Privacy</Link>
            <Link href="/terms" className="hover:underline">Terms</Link>
            <Link href="/status" className="hover:underline">Status</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string; }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border p-6 transition-colors hover:bg-muted/50">
      <div className="text-primary">{icon}</div>
      <div><h3 className="font-semibold mb-2">{title}</h3><p className="text-sm text-muted-foreground">{description}</p></div>
    </div>
  );
}
