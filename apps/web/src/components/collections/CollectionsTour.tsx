import { Step } from "react-joyride";

export const COLLECTIONS_LIST_TOUR: Step[] = [
  {
    target: "body",
    placement: "center",
    title: "Bem-vindo às suas Coleções!",
    content: "Aqui é onde você organiza suas cartas em pastas. Você pode criar coleções para exibir sua raridades ou para vender no mercado.",
  },
  {
    target: ".tour-create-collection",
    title: "Crie sua primeira pasta",
    content: "Clique aqui para começar. Você poderá escolher se a pasta é uma Coleção Comum (para organizar) ou uma Loja (para vender e receber propostas).",
  },
  {
    target: ".tour-inventory-info",
    title: "Seu Inventário",
    content: "Aqui você vê quantas cartas totais você possui cadastradas no sistema.",
  }
];

export const COLLECTION_DETAIL_TOUR: Step[] = [
  {
    target: ".tour-edit-name",
    title: "Edite o nome",
    content: "Clique no ícone de lápis ou diretamente no nome para renomear sua pasta a qualquer momento.",
  },
  {
    target: ".tour-save-folder",
    title: "Salve suas alterações",
    content: "Sempre que fizer mudanças, este botão ficará destacado. Não esqueça de salvar antes de sair!",
  },
  {
    target: ".tour-delete-folder",
    title: "Excluir pasta",
    content: "Se não precisar mais desta pasta, você pode excluí-la aqui. Fique tranquilo, as cartas voltarão para o seu inventário geral.",
  },
  {
    target: ".tour-add-cards",
    title: "Adicione cartas",
    content: "Use este botão para selecionar quais cartas do seu inventário geral devem aparecer nesta pasta específica.",
  },
  {
    target: ".tour-collection-filters",
    title: "Filtros rápidos",
    content: "Organize sua visualização por Tipo, Raridade ou Variante para encontrar cartas rapidamente.",
  },
  {
    target: ".tour-card-item",
    title: "Gerencie cada carta",
    content: "Você pode remover uma carta da pasta clicando no ícone de LIXEIRA que aparece em cima dela.",
  },
  {
    target: ".tour-card-price-input",
    title: "Valor customizado",
    content: "Para alterar o valor de uma carta na loja, clique neste campo, informe o preço desejado e aguarde: o valor é salvo automaticamente.",
  },
  {
    target: ".tour-visibility-settings",
    title: "Configurações de Venda",
    content: "Aqui você define se esta pasta é uma Loja. Ao ativar o modo Loja, outros colecionadores poderão ver seus preços e te enviar propostas!",
  },
  {
    target: ".tour-banner-upload",
    title: "Personalize com um Banner",
    content: "Deixe sua loja mais profissional enviando uma imagem de capa personalizada.",
  },
  {
    target: ".tour-share-collection",
    title: "Compartilhe seu link",
    content: "Gere um link exclusivo da sua coleção para postar em redes sociais ou enviar para interessados.",
  }
];

export const PUBLIC_COLLECTION_TOUR: Step[] = [
  {
    target: "body",
    placement: "center",
    title: "Bem-vindo à Coleção!",
    content: "Esta é uma coleção compartilhada. Você pode ver as cartas e enviar propostas de compra diretamente para o dono.",
  },
  {
    target: ".tour-public-header",
    title: "Informações da Coleção",
    content: "Aqui você vê o nome da coleção, o dono e o valor total estimado das cartas.",
  },
  {
    target: ".tour-public-filters",
    title: "Encontre Cartas",
    content: "Use a busca e os filtros para encontrar cartas específicas por nome, tipo, raridade ou valor.",
  },
  {
    target: ".tour-add-to-cart",
    title: "Monte seu Carrinho",
    content: "Clique em 'Adicionar' para incluir cartas no seu carrinho de propostas. Experimente adicionar uma agora!",
  }
];

export const PUBLIC_COLLECTION_CART_TOUR: any[] = [
  {
    target: "body",
    placement: "center",
    title: "Sua Proposta",
    content: "Aqui você gerencia as cartas selecionadas, ajusta quantidades e valores individuais.",
  },
  {
    target: ".tour-global-mode",
    title: "Valor Total",
    content: "Se preferir, você pode ativar o modo de valor final para dar um lance único por todo o lote, sem precisar definir preços individuais.",
  },
  {
    target: ".tour-finalize-proposal",
    title: "Envie sua Oferta",
    content: "Quando estiver pronto, finalize a proposta. O dono da coleção será notificado!",
  }
];


export const COLLECTION_CREATE_TOUR: Step[] = [
  {
    target: ".tour-create-name",
    title: "Dê um nome à sua pasta",
    content: "Escolha um nome que ajude a identificar o conteúdo, como 'Deck de Fogo' ou 'Minhas Raras'.",
  },
  {
    target: ".tour-create-mode",
    title: "Escolha o objetivo",
    content: "Escolha 'Visualizar' para organizar sua coleção, ou 'Vender' se quiser que esta pasta vire uma Loja pública.",
  },
  {
    target: ".tour-create-add-cards",
    title: "Selecione as cartas",
    content: "Clique aqui para escolher quais cartas do seu inventário entrarão nesta pasta. Você também pode fazer isso depois!",
  }
];
