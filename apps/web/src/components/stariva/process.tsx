const steps = [
  {
    n: "01",
    title: "Идея и размеры",
    text: "Вы описываете задачу или присылаете фото. Мастер помогает с замерами, подбирает материал, цвет и плетение.",
  },
  {
    n: "02",
    title: "Расчёт и согласование",
    text: "До оплаты согласуем параметры изделия, точную цену, срок изготовления и условия доставки. Затем мастер сообщит способ оплаты.",
  },
  {
    n: "03",
    title: "Работа и доставка",
    text: "После согласования и оплаты мастер создаёт изделие. Проверяем готовую работу, упаковываем и отправляем выбранным способом.",
  },
];
export function Process() {
  return (
    <section className="py-12 lg:py-20 bg-parchment border-t border-espresso/10">
      <div className="max-w-[1400px] mx-auto px-5 lg:px-10">
        <p className="label-caps text-terracotta mb-4">Как всё происходит</p>
        <h2 className="font-serif text-3xl lg:text-5xl text-espresso">
          От вашей идеи <span className="italic">до готовой работы</span>
        </h2>
        <div className="mt-8 grid md:grid-cols-3 gap-7 lg:gap-12">
          {steps.map((step) => (
            <div key={step.n} className="border-t border-espresso/15 pt-5">
              <span className="text-terracotta text-sm">{step.n}</span>
              <h3 className="font-serif text-2xl mt-3">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-espresso/75">
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
