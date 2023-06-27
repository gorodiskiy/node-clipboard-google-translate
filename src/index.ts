import notifier from "node-notifier";
import { GoogleTranslator } from "@translate-tools/core/translators/GoogleTranslator/index.js";
import minimist from "minimist";
import {
  FlexLayout,
  QApplication,
  QClipboard,
  QClipboardMode,
  QCheckBox,
  QLabel,
  QLineEdit,
  CheckState,
  QPlainTextEdit,
  QScrollArea,
  QComboBox,
  QMainWindow,
  QPushButton,
  QWidget,
} from "@nodegui/nodegui";

interface ClipTranslateInterface {
  text: string;
  to: string;
  from: string;
  delay: number;
  translator: any;
  clipboard: any;
  win: any;
  winStatus: any;
  winText: any;
  winCheckbox: any;
  clipboardOverride: boolean;
}

class ClipTranslate {
  text: string;
  to: string;
  from: string;
  delay: number;
  translator: any;
  clipboard: any;
  win: any;
  winStatus: any;
  winText: any;
  winCheckbox: any;
  clipboardOverride: boolean;

  constructor() {
    var argv = minimist(process.argv.slice(2));
    this.from = argv.from ?? "en";
    this.to = argv.to ?? "it";
    this.delay = argv.delay ?? 200;
    this.translator = new GoogleTranslator({
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36",
      },
    });
    this.clipboardOverride = true;
    this.text = "";
    this.clipboard = QApplication.clipboard();
    this._window();
  }

  private _sleep(time: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, time));
  }

  private _windowStatus(text: string, statusType: "error" | "success" = "success"): void {
    this.winStatus.setText(text);
    switch (statusType) {
      case "error":
        this.winStatus.setInlineStyle("color: red;");
        break;
      case "success":
        this.winStatus.setInlineStyle("color: green;");
        break;
      default:
        break;
    }
  }

  private _window(): void {
    const win = new QMainWindow();
    win.setWindowTitle("Translator");
    win.resize(200, 200);

    // Основная область
    const centralWidget = new QWidget();
    centralWidget.setObjectName("rootView");
    const rootLayout = new FlexLayout();
    centralWidget.setLayout(rootLayout);

    // Область для кнопки и чекбокса
    const fieldset = new QWidget();
    fieldset.setObjectName("operationView");
    const fieldsetLayout = new FlexLayout();
    fieldset.setLayout(fieldsetLayout);

    // Кнопка
    const buttonCopy = new QPushButton();
    buttonCopy.setText("Скопировать");
    buttonCopy.setObjectName("buttonCopy");
    // Принудительно копируем в буфер содержимое текста с результатом
    buttonCopy.addEventListener("clicked", () => {
      this.clipboard.setText(this.text, QClipboardMode.Clipboard);
    });

    // Статус
    const statusLabel = new QLabel();
    statusLabel.setInlineStyle(`color: green;`);
    statusLabel.setObjectName("statusLabel");

    // Чекбокс
    const isRun = new QCheckBox();
    isRun.setText("Включить перевод буфера");
    isRun.setObjectName("isRun");
    isRun.setCheckState(CheckState.Checked);
    isRun.addEventListener("toggled", () => {
      this.clipboardOverride = isRun.isChecked();
      statusLabel.setText(this.clipboardOverride ? "Перевод буфера активен" : "Отключен перевод буфера");
    });

    // Направление перевода
    const langFromInput = new QLineEdit();
    langFromInput.setObjectName("langFromInput");
    const langToInput = new QLineEdit();
    langToInput.setObjectName("langToInput");

    const langFromComboBox = new QComboBox();
    langFromComboBox.setObjectName("langFromComboBox");
    const langToComboBox = new QComboBox();
    langToComboBox.setObjectName("langToComboBox");

    // Заполняем направления перевода
    const availableLangs = GoogleTranslator.getSupportedLanguages();
    for (let lang of availableLangs) {
      langFromComboBox.addItem(undefined, lang);
      langToComboBox.addItem(undefined, lang);
    }
    langFromComboBox.addEventListener("currentTextChanged", (text: any) => {
      this.from = text;
      statusLabel.setText(`Перевод с ${this.from}`);
    });
    langToComboBox.addEventListener("currentTextChanged", (text: any) => {
      this.to = text;
      statusLabel.setText(`Перевод на ${this.to}`);
    });
    langFromComboBox.setCurrentText(this.from);
    langToComboBox.setCurrentText(this.to);

    // Текст с результатом
    const textWork = new QPlainTextEdit();
    textWork.setObjectName("textWork");
    textWork.setReadOnly(true);
    textWork.setWordWrapMode(3);
    textWork.setPlainText(``);

    // Добавляем кнопку и чекбокс
    fieldsetLayout.addWidget(buttonCopy);
    fieldsetLayout.addWidget(isRun);
    fieldsetLayout.addWidget(langFromComboBox);
    fieldsetLayout.addWidget(langToComboBox);

    // Добавляем группу с кнопками и чекбоксом
    rootLayout.addWidget(fieldset);
    // Добавляем статус
    rootLayout.addWidget(statusLabel);
    // Добавляем поле с результатом
    rootLayout.addWidget(textWork);

    // TODO: Стили
    win.setStyleSheet(`
            #rootView{
                flex: 1;
            }
            #operationView{
                flex: 1;
            }
            #buttonCopy, #isRun, #langFromComboBox, #langToComboBox{
                flex-direction: row;
            }
            #statusLabel {
                flex: 1;
            }
            #textWork {
                flex: 3;
                background-color: white;
            }
            `);
    win.setCentralWidget(centralWidget);
    win.show();

    this.win = win;
    this.winStatus = statusLabel;
    this.winText = textWork;
    this.winCheckbox = isRun;
  }

  public async run(): Promise<void> {
    await this._sleep(this.delay);

    try {
      let clipText = this._getClipboard();
      if (clipText != this.text && clipText != "" && this.clipboardOverride) {
        this._windowStatus("Переводим");
        this.text = clipText;
        let translated = await this.translator.translate(this.text, this.from, this.to);
        notifier.notify({
          title: clipText,
          message: translated,
        });
        this._setText(translated);
        this._windowStatus("Готово");
      }
    } catch (e) {
      notifier.notify("Error translate");
      this._windowStatus("Ошибка", "error");
      console.log(e);
    }

    this.run();
  }

  private _setText(text: string): void {
    this.text = text;
    this.winText.setPlainText(this.text);
    this.clipboard.setText(this.text, QClipboardMode.Clipboard);
    this._windowStatus("Текст в скопирован в буфер обмена");
  }

  private _getClipboard(): string {
    return this.clipboard.text(QClipboardMode.Clipboard);
  }
}

new ClipTranslate().run();
