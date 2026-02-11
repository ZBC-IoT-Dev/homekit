import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DashboardHome = {
  name: string;
};

export function Dashboard({ home }: { home: DashboardHome }) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Oversigt</h1>
        <p className="text-muted-foreground">
          Velkommen til{" "}
          <span className="font-medium text-foreground">{home.name}</span>
        </p>
      </div>

      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        {["Aktivitet", "Klima", "Strøm"].map((title) => (
          <Card key={title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-24 rounded-md bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="min-h-80">
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Oversigt over hjemmet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56 rounded-md bg-muted" />
        </CardContent>
      </Card>
    </div>
  );
}
