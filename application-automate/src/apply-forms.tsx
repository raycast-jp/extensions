import { ActionPanel, Action, Icon, List, showToast, Toast, open } from "@raycast/api";

interface FormPreset {
  id: number;
  companyName: string;
  name: string;
  email: string;
  address: string;
  phone?: string;
  comment?: string;
}

interface Form {
  id: string;
  name: string;
  url: string;
  presets: FormPreset[];
}

const FORMS: Form[] = [
  {
    id: "form1",
    name: "お問い合わせフォーム",
    url: "https://docs.google.com/forms/d/e/1FAIpQLSdZ05WVF7M0316CS5tPsDQZRC1YEEuWggMAq3jDj6RqvS9wEw/viewform",
    presets: [
      {
        id: 1,
        companyName: "ChiikawaX株式会社",
        name: "山田太郎",
        email: "yamada@example.com",
        address: "東京都渋谷区渋谷1-1-1",
        phone: "03-1234-5678",
        comment: "サンプルのお問い合わせです。",
      },
      {
        id: 2,
        companyName: "ウレシーサー株式会社",
        name: "鈴木一郎",
        email: "suzuki@example.com",
        address: "大阪府大阪市中央区1-1-1",
        phone: "06-1234-5678",
      },
    ],
  },
];

async function applyForm(form: Form, preset: FormPreset) {
  const formParams = {
    "entry.2005620554": preset.companyName,   // 会社名
    "entry.185333929": preset.name,           // 名前
    "entry.1045781291": preset.email,         // メールアドレス
    "entry.1065046570": preset.address,       // 住所
    "entry.1166974658": preset.phone || "",   // 電話番号
    "entry.839337160": preset.comment || "",  // コメント
  };

  const params = new URLSearchParams(formParams);
  const url = `${form.url}?${params.toString()}`;
  await open(url);
  await showToast({
    style: Toast.Style.Success,
    title: "フォームを開きました",
    message: "自動入力用のURLを開きました",
  });
}

export default function Command() {
  return (
    <List>
      {FORMS.map((form) => (
        <List.Item
          key={form.id}
          icon={Icon.Document}
          title={form.name}
          actions={
            <ActionPanel>
              <Action.Push
                title="プリセットを選択"
                icon={Icon.List}
                target={
                  <List>
                    {form.presets.map((preset) => (
                      <List.Item
                        key={preset.id}
                        icon={Icon.Person}
                        title={preset.companyName}
                        subtitle={preset.name}
                        accessories={[{ text: preset.email }]}
                        actions={
                          <ActionPanel>
                            <Action
                              title="フォームに自動入力"
                              icon={Icon.Upload}
                              onAction={() => applyForm(form, preset)}
                            />
                            <Action.CopyToClipboard
                              title="会社名をコピー"
                              content={preset.companyName}
                              shortcut={{ modifiers: ["cmd"], key: "c" }}
                            />
                          </ActionPanel>
                        }
                      />
                    ))}
                  </List>
                }
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
