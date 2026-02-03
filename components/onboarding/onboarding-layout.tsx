import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateHomeForm } from "./create-home-form";
import { JoinHomeForm } from "./join-home-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function OnboardingLayout() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8 p-4">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Welcome to HomeKit
        </h1>
        <p className="text-muted-foreground text-lg">
          Your smart home journey starts here.
        </p>
      </div>

      <Card className="w-full max-w-md shadow-lg border-zinc-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle>Get Started</CardTitle>
          <CardDescription>
            Create a new home or join an existing one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="create">Create Home</TabsTrigger>
              <TabsTrigger value="join">Join Home</TabsTrigger>
            </TabsList>
            <TabsContent value="create">
              <CreateHomeForm />
            </TabsContent>
            <TabsContent value="join">
              <JoinHomeForm />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
