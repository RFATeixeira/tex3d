import { Filaments } from "@/components/filaments";
import { PageTitle } from "@/components/ui";

export default function FilamentsPage() {
  return (
    <>
      <PageTitle
        eyebrow="MATERIAIS PARA SUAS IDEIAS"
        title="Filamentos"
        description="Gerencie seus rolos, cores e materiais em um só lugar."
      />
      <Filaments />
    </>
  );
}
