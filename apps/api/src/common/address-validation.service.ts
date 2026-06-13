import { Injectable, InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class AddressValidationService {
  private readonly IBGE_API_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades';

  /**
   * Valida se uma cidade existe em um determinado estado brasileiro usando a API do IBGE.
   * @param state Sigla do estado (UF)
   * @param cityName Nome da cidade
   */
  async validateCity(state: string, cityName: string): Promise<boolean> {
    try {
      // Normaliza o nome da cidade para comparação
      const normalizedInput = this.normalizeText(cityName);

      // Busca os municípios do estado na API do IBGE
      const response = await fetch(`${this.IBGE_API_URL}/estados/${state.toUpperCase()}/municipios`);
      
      if (!response.ok) {
        if (response.status === 404) return false;
        throw new Error(`IBGE API returned ${response.status}`);
      }

      const cities = await response.json() as Array<{ nome: string }>;
      
      // Verifica se existe alguma cidade com o nome normalizado igual
      return cities.some(city => this.normalizeText(city.nome) === normalizedInput);
    } catch (error) {
      console.error('Erro ao validar cidade no IBGE:', error);
      // Em caso de erro na API externa, permitimos passar para não bloquear o usuário (fail-open)
      // Ou podemos lançar um erro dependendo da política de rigor.
      return true; 
    }
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9]/g, '') // Remove espaços e caracteres especiais
      .trim();
  }
}
