import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DashboardHome = {
  name: string;
};

export function Dashboard({ home }: { home: DashboardHome }) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">
          Welcome to{" "}
          <span className="font-medium text-foreground">{home.name}</span>
        </p>
      </div>

      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        {["Activity", "Climate", "Power"].map((title) => (
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

      <Card className="min-h-[320px]">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Home Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] rounded-md bg-muted" />
        </CardContent>
      </Card>
    </div>
  );
}
