import { groups, type Exercise, type Plan } from "./domain";
const entries: Record<(typeof groups)[number], string> = {
  Peito: `Supino reto com barra|Barra
Supino inclinado com barra|Barra
Supino declinado com barra|Barra
Supino reto com halteres|Halteres
Supino inclinado com halteres|Halteres
Supino declinado com halteres|Halteres
Supino na máquina|Máquina
Supino inclinado na máquina|Máquina
Crucifixo reto|Halteres
Crucifixo inclinado|Halteres
Crucifixo no cabo|Cabo
Crossover alto|Cabo
Crossover baixo|Cabo
Peck deck|Máquina
Flexão de braços|Peso corporal
Flexão inclinada|Peso corporal
Flexão declinada|Peso corporal
Pullover com halter|Halteres`,
  Costas: `Puxada frontal aberta|Cabo
Puxada frontal neutra|Cabo
Puxada supinada|Cabo
Puxada unilateral|Cabo
Barra fixa pronada|Barra fixa
Barra fixa supinada|Barra fixa
Barra fixa neutra|Barra fixa
Remada curvada pronada|Barra
Remada curvada supinada|Barra
Remada unilateral com halter|Halteres
Remada baixa com triângulo|Cabo
Remada baixa aberta|Cabo
Remada cavalinho|Barra
Remada na máquina|Máquina
Remada com apoio no peito|Halteres
Remada invertida|Peso corporal
Pulldown com braços estendidos|Cabo
Pullover na máquina|Máquina
Remada unilateral no cabo|Cabo
Remada alta para costas|Máquina`,
  Ombros: `Desenvolvimento com barra|Barra
Desenvolvimento com halteres|Halteres
Desenvolvimento na máquina|Máquina
Desenvolvimento Arnold|Halteres
Elevação lateral com halteres|Halteres
Elevação lateral no cabo|Cabo
Elevação lateral na máquina|Máquina
Elevação frontal com halteres|Halteres
Elevação frontal com barra|Barra
Elevação frontal no cabo|Cabo
Crucifixo inverso com halteres|Halteres
Crucifixo inverso na máquina|Máquina
Face pull|Cabo
Remada alta com barra|Barra
Encolhimento com halteres|Halteres
Encolhimento com barra|Barra
Rotação externa no cabo|Cabo
Rotação externa com elástico|Elástico`,
  Bíceps: `Rosca direta com barra|Barra
Rosca direta com halteres|Halteres
Rosca alternada|Halteres
Rosca martelo|Halteres
Rosca concentrada|Halteres
Rosca Scott com barra|Barra
Rosca Scott com halter|Halteres
Rosca Scott na máquina|Máquina
Rosca inclinada|Halteres
Rosca no cabo baixo|Cabo
Rosca no cabo alto|Cabo
Rosca inversa com barra|Barra
Rosca martelo com corda|Cabo
Rosca Zottman|Halteres
Rosca com elástico|Elástico`,
  Tríceps: `Tríceps na polia com corda|Cabo
Tríceps na polia com barra|Cabo
Tríceps unilateral no cabo|Cabo
Tríceps testa com barra|Barra
Tríceps testa com halteres|Halteres
Tríceps francês com halter|Halteres
Tríceps francês no cabo|Cabo
Tríceps coice com halter|Halteres
Tríceps coice no cabo|Cabo
Supino fechado|Barra
Mergulho nas paralelas|Paralelas
Mergulho no banco|Banco
Tríceps na máquina|Máquina
Flexão com mãos próximas|Peso corporal
Tríceps com elástico|Elástico`,
  Quadríceps: `Agachamento livre|Barra
Agachamento frontal|Barra
Agachamento goblet|Halteres
Agachamento no Smith|Smith
Agachamento hack|Máquina
Leg press 45 graus|Máquina
Leg press horizontal|Máquina
Cadeira extensora|Máquina
Extensora unilateral|Máquina
Afundo com halteres|Halteres
Passada caminhando|Halteres
Agachamento búlgaro|Halteres
Subida no banco|Banco
Agachamento com peso corporal|Peso corporal
Agachamento na parede|Peso corporal`,
  "Posteriores e glúteos": `Levantamento terra|Barra
Levantamento terra romeno|Barra
Stiff com halteres|Halteres
Stiff com barra|Barra
Terra sumô|Barra
Mesa flexora|Máquina
Cadeira flexora|Máquina
Flexora unilateral em pé|Máquina
Elevação pélvica com barra|Barra
Elevação pélvica na máquina|Máquina
Ponte de glúteos|Peso corporal
Ponte unilateral|Peso corporal
Coice no cabo|Cabo
Abdução no cabo|Cabo
Cadeira abdutora|Máquina
Cadeira adutora|Máquina
Bom dia com barra|Barra
Extensão lombar no banco|Banco
Flexão nórdica|Peso corporal
Caminhada lateral com elástico|Elástico`,
  Panturrilhas: `Panturrilha em pé na máquina|Máquina
Panturrilha sentada|Máquina
Panturrilha no leg press|Máquina
Panturrilha em pé com halteres|Halteres
Panturrilha unilateral|Peso corporal
Panturrilha no Smith|Smith
Panturrilha no degrau|Peso corporal
Elevação de ponta dos pés|Peso corporal`,
  Abdômen: `Abdominal tradicional|Peso corporal
Abdominal no cabo|Cabo
Abdominal na máquina|Máquina
Abdominal inverso|Peso corporal
Abdominal bicicleta|Peso corporal
Abdominal oblíquo|Peso corporal
Elevação de pernas na barra|Barra fixa
Elevação de joelhos na paralela|Paralelas
Elevação de pernas deitado|Peso corporal
Prancha frontal|Peso corporal
Prancha lateral|Peso corporal
Prancha com toque no ombro|Peso corporal
Abdominal com roda|Roda abdominal
Rotação de tronco no cabo|Cabo
Pallof press|Cabo
Abdominal remador|Peso corporal
Inseto morto|Peso corporal
Perdigueiro|Peso corporal`,
  Cardio: `Corrida na esteira|Esteira
Corrida ao ar livre|Sem equipamento
Caminhada na esteira|Esteira
Caminhada ao ar livre|Sem equipamento
Bicicleta ergométrica|Bicicleta
Ciclismo ao ar livre|Bicicleta
Elíptico|Elíptico
Remo ergométrico|Remo
Natação|Piscina
Escada ergométrica|Máquina`,
};
export const catalog: Exercise[] = groups.flatMap((group, gi) =>
  entries[group].split("\n").map((line, i) => {
    const [name, equipment] = line.split("|");
    return {
      id: `base-${gi}-${i}`,
      revision: 1,
      name,
      group,
      equipment,
      custom: false,
    };
  }),
);
export function starterPlans(): Plan[] {
  const make = (
    id: string,
    name: string,
    weekdays: number[],
    names: string[],
  ): Plan => ({
    id,
    revision: 1,
    name,
    weekdays,
    archived: false,
    items: names.map((name, i) => ({
      id: `${id}-${i}`,
      exerciseId: catalog.find((e) => e.name === name)!.id,
      sets: 3,
      minReps: 8,
      maxReps: 12,
      load: 0,
      restSeconds: 90,
    })),
  });
  return [
    make(
      "modelo-a",
      "Treino A · Peito e tríceps",
      [1, 4],
      [
        "Supino reto com halteres",
        "Supino inclinado com halteres",
        "Tríceps na polia com corda",
      ],
    ),
    make(
      "modelo-b",
      "Treino B · Costas e bíceps",
      [2, 5],
      [
        "Puxada frontal aberta",
        "Remada baixa com triângulo",
        "Rosca alternada",
      ],
    ),
    make(
      "modelo-c",
      "Treino C · Pernas e ombros",
      [3, 6],
      ["Agachamento goblet", "Mesa flexora", "Desenvolvimento com halteres"],
    ),
  ];
}
