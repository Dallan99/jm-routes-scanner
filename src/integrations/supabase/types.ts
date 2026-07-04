export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json | null
          entidade: string | null
          entidade_id: string | null
          id: string
          ip: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json | null
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json | null
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bases: {
        Row: {
          ativa: boolean
          cidade: string
          codigo: string
          created_at: string
          id: string
          nome: string
          uf: string
        }
        Insert: {
          ativa?: boolean
          cidade: string
          codigo: string
          created_at?: string
          id?: string
          nome: string
          uf: string
        }
        Update: {
          ativa?: boolean
          cidade?: string
          codigo?: string
          created_at?: string
          id?: string
          nome?: string
          uf?: string
        }
        Relationships: []
      }
      escalas: {
        Row: {
          bairro: string | null
          base_id: string
          cidade: string | null
          created_at: string
          data_referencia: string
          driver: string | null
          giro: string | null
          id: string
          importado_por: string | null
          modal: string | null
          otimizada: string | null
          pacotes: number | null
          paradas: number | null
          placa: string | null
          placa_troca: string | null
          planejada: string | null
          roteiro: string | null
          tipo: string | null
          vaga: string | null
        }
        Insert: {
          bairro?: string | null
          base_id: string
          cidade?: string | null
          created_at?: string
          data_referencia?: string
          driver?: string | null
          giro?: string | null
          id?: string
          importado_por?: string | null
          modal?: string | null
          otimizada?: string | null
          pacotes?: number | null
          paradas?: number | null
          placa?: string | null
          placa_troca?: string | null
          planejada?: string | null
          roteiro?: string | null
          tipo?: string | null
          vaga?: string | null
        }
        Update: {
          bairro?: string | null
          base_id?: string
          cidade?: string | null
          created_at?: string
          data_referencia?: string
          driver?: string | null
          giro?: string | null
          id?: string
          importado_por?: string | null
          modal?: string | null
          otimizada?: string | null
          pacotes?: number | null
          paradas?: number | null
          placa?: string | null
          placa_troca?: string | null
          planejada?: string | null
          roteiro?: string | null
          tipo?: string | null
          vaga?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalas_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      motoristas: {
        Row: {
          ativo: boolean
          base_id: string | null
          cnh: string | null
          cpf: string | null
          created_at: string
          id: string
          nome: string
          placa: string | null
          transportadora: string | null
        }
        Insert: {
          ativo?: boolean
          base_id?: string | null
          cnh?: string | null
          cpf?: string | null
          created_at?: string
          id?: string
          nome: string
          placa?: string | null
          transportadora?: string | null
        }
        Update: {
          ativo?: boolean
          base_id?: string | null
          cnh?: string | null
          cpf?: string | null
          created_at?: string
          id?: string
          nome?: string
          placa?: string | null
          transportadora?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "motoristas_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          base_id: string | null
          created_at: string
          email: string
          id: string
          matricula: string | null
          nome: string
        }
        Insert: {
          ativo?: boolean
          base_id?: string | null
          created_at?: string
          email: string
          id: string
          matricula?: string | null
          nome: string
        }
        Update: {
          ativo?: boolean
          base_id?: string | null
          created_at?: string
          email?: string
          id?: string
          matricula?: string | null
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      recebimentos: {
        Row: {
          base_id: string | null
          codigo_bipado: string
          created_at: string
          id: string
          ip: string | null
          mensagem: string | null
          operador_id: string
          resultado: Database["public"]["Enums"]["recebimento_resultado"]
          rota_id: string | null
          tempo_desde_ultima_ms: number | null
          user_agent: string | null
          volume_id: string | null
        }
        Insert: {
          base_id?: string | null
          codigo_bipado: string
          created_at?: string
          id?: string
          ip?: string | null
          mensagem?: string | null
          operador_id: string
          resultado: Database["public"]["Enums"]["recebimento_resultado"]
          rota_id?: string | null
          tempo_desde_ultima_ms?: number | null
          user_agent?: string | null
          volume_id?: string | null
        }
        Update: {
          base_id?: string | null
          codigo_bipado?: string
          created_at?: string
          id?: string
          ip?: string | null
          mensagem?: string | null
          operador_id?: string
          resultado?: Database["public"]["Enums"]["recebimento_resultado"]
          rota_id?: string | null
          tempo_desde_ultima_ms?: number | null
          user_agent?: string | null
          volume_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      rotas: {
        Row: {
          base_id: string
          base_origem_id: string | null
          cidade: string
          codigo: string
          created_at: string
          data_expedicao: string
          data_prevista: string | null
          destinatario_cep: string | null
          destinatario_complemento: string | null
          destinatario_endereco: string | null
          destinatario_nome: string | null
          id: string
          janela_despacho: string | null
          motorista_id: string | null
          nf: string | null
          pack_id: string | null
          quantidade_prevista: number
          rota_final: string | null
          status: Database["public"]["Enums"]["rota_status"]
          transportadora: string | null
          updated_at: string
        }
        Insert: {
          base_id: string
          base_origem_id?: string | null
          cidade: string
          codigo: string
          created_at?: string
          data_expedicao?: string
          data_prevista?: string | null
          destinatario_cep?: string | null
          destinatario_complemento?: string | null
          destinatario_endereco?: string | null
          destinatario_nome?: string | null
          id?: string
          janela_despacho?: string | null
          motorista_id?: string | null
          nf?: string | null
          pack_id?: string | null
          quantidade_prevista?: number
          rota_final?: string | null
          status?: Database["public"]["Enums"]["rota_status"]
          transportadora?: string | null
          updated_at?: string
        }
        Update: {
          base_id?: string
          base_origem_id?: string | null
          cidade?: string
          codigo?: string
          created_at?: string
          data_expedicao?: string
          data_prevista?: string | null
          destinatario_cep?: string | null
          destinatario_complemento?: string | null
          destinatario_endereco?: string | null
          destinatario_nome?: string | null
          id?: string
          janela_despacho?: string | null
          motorista_id?: string | null
          nf?: string | null
          pack_id?: string | null
          quantidade_prevista?: number
          rota_final?: string | null
          status?: Database["public"]["Enums"]["rota_status"]
          transportadora?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rotas_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotas_base_origem_id_fkey"
            columns: ["base_origem_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotas_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotas_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      volumes: {
        Row: {
          codigo: string
          created_at: string
          id: string
          recebido: boolean
          recebido_em: string | null
          recebido_por: string | null
          rota_id: string
          sequencia: number
          total: number
        }
        Insert: {
          codigo: string
          created_at?: string
          id?: string
          recebido?: boolean
          recebido_em?: string | null
          recebido_por?: string | null
          rota_id: string
          sequencia: number
          total: number
        }
        Update: {
          codigo?: string
          created_at?: string
          id?: string
          recebido?: boolean
          recebido_em?: string | null
          recebido_por?: string | null
          rota_id?: string
          sequencia?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "volumes_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      motoristas_safe: {
        Row: {
          ativo: boolean | null
          base_id: string | null
          created_at: string | null
          id: string | null
          nome: string | null
          placa: string | null
          transportadora: string | null
        }
        Insert: {
          ativo?: boolean | null
          base_id?: string | null
          created_at?: string | null
          id?: string | null
          nome?: string | null
          placa?: string | null
          transportadora?: string | null
        }
        Update: {
          ativo?: boolean | null
          base_id?: string | null
          created_at?: string | null
          id?: string | null
          nome?: string | null
          placa?: string | null
          transportadora?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "motoristas_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "operador" | "gerente"
      recebimento_resultado:
        | "ok"
        | "duplicado"
        | "inexistente"
        | "outra_rota"
        | "outra_base"
        | "cancelada"
        | "encerrada"
        | "volume_repetido"
      rota_status:
        | "pendente"
        | "em_recebimento"
        | "recebida_parcial"
        | "recebida_completa"
        | "cancelada"
        | "encerrada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "supervisor", "operador", "gerente"],
      recebimento_resultado: [
        "ok",
        "duplicado",
        "inexistente",
        "outra_rota",
        "outra_base",
        "cancelada",
        "encerrada",
        "volume_repetido",
      ],
      rota_status: [
        "pendente",
        "em_recebimento",
        "recebida_parcial",
        "recebida_completa",
        "cancelada",
        "encerrada",
      ],
    },
  },
} as const
