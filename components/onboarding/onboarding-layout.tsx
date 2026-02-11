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
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-8 p-4">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight">
          Velkommen til HomeKit
        </h1>
        <p className="text-muted-foreground text-lg">
          Dit smarthjem starter her.
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Kom i gang</CardTitle>
          <CardDescription>
            Opret et nyt hjem eller deltag i et eksisterende.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="create">Opret hjem</TabsTrigger>
              <TabsTrigger value="join">Deltag i hjem</TabsTrigger>
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
