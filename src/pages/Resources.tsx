import { Calendar, User, ArrowRight, BookOpen, Heart, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Resources = () => {
  const articles = [
    {
      id: 1,
      title: "Understanding Early Signs of Dementia: A Family Guide",
      excerpt: "Learn to recognize the subtle early warning signs of dementia and when to seek professional help for your loved ones.",
      category: "Family Support",
      author: "Dr. Sarah Chen",
      date: "March 15, 2024",
      readTime: "8 min read",
      featured: true,
      icon: Heart
    },
    {
      id: 2,
      title: "The Science Behind AI-Powered Cognitive Assessment",
      excerpt: "Discover how machine learning algorithms can detect cognitive changes with unprecedented accuracy and precision.",
      category: "Technology",
      author: "Prof. Michael Rodriguez",
      date: "March 10, 2024",
      readTime: "12 min read",
      featured: true,
      icon: BookOpen
    },
    {
      id: 3,
      title: "Caregiver Support: Managing the Emotional Journey",
      excerpt: "Practical advice and emotional support strategies for families navigating cognitive health challenges together.",
      category: "Caregiver Tips",
      author: "Lisa Thompson, LCSW",
      date: "March 5, 2024",
      readTime: "6 min read",
      featured: false,
      icon: Users
    },
    {
      id: 4,
      title: "Latest Research in Early Dementia Detection",
      excerpt: "Recent breakthrough studies show how early intervention can significantly improve quality of life outcomes.",
      category: "Research",
      author: "Dr. James Park",
      date: "February 28, 2024",
      readTime: "10 min read",
      featured: false,
      icon: BookOpen
    },
    {
      id: 5,
      title: "Building a Support Network: Community Resources",
      excerpt: "Connect with local support groups, healthcare providers, and community resources for cognitive health.",
      category: "Community",
      author: "Maria Gonzalez",
      date: "February 20, 2024",
      readTime: "7 min read",
      featured: false,
      icon: Users
    },
    {
      id: 6,
      title: "Healthy Brain Habits: Lifestyle Changes That Matter",
      excerpt: "Evidence-based lifestyle modifications that can support cognitive health and potentially reduce dementia risk.",
      category: "Wellness",
      author: "Dr. Amanda Foster",
      date: "February 15, 2024",
      readTime: "9 min read",
      featured: false,
      icon: Heart
    }
  ];

  const categories = [
    { name: "All Articles", count: articles.length },
    { name: "Family Support", count: articles.filter(a => a.category === "Family Support").length },
    { name: "Caregiver Tips", count: articles.filter(a => a.category === "Caregiver Tips").length },
    { name: "Research", count: articles.filter(a => a.category === "Research").length },
    { name: "Technology", count: articles.filter(a => a.category === "Technology").length },
    { name: "Wellness", count: articles.filter(a => a.category === "Wellness").length }
  ];

  const featuredArticles = articles.filter(article => article.featured);
  const regularArticles = articles.filter(article => !article.featured);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-brain">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-6 animate-fade-in">
            Resources & <span className="text-gradient">Insights</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto animate-slide-up">
            Expert guidance, research insights, and practical support for families navigating cognitive health.
          </p>
        </div>
      </section>

      {/* Categories */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 border-b border-border">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap gap-4 justify-center">
            {categories.map((category, index) => (
              <button
                key={index}
                className={`px-4 py-2 rounded-full transition-all duration-300 ${
                  index === 0 
                    ? 'bg-primary text-primary-foreground shadow-soft' 
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                {category.name} ({category.count})
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Articles */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-foreground mb-8">Featured Articles</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            {featuredArticles.map((article, index) => (
              <Card key={article.id} className="shadow-card card-hover cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full">
                      {article.category}
                    </span>
                    <div className="p-2 bg-gradient-hero rounded-lg">
                      <article.icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <CardTitle className="text-xl hover:text-primary transition-colors">
                    {article.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    {article.excerpt}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <span>{article.author}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4" />
                        <span>{article.date}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 text-primary hover:text-primary-dark transition-colors">
                      <span className="text-sm font-medium">Read More</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* All Articles */}
          <h2 className="text-3xl font-bold text-foreground mb-8">All Articles</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {regularArticles.map((article, index) => (
              <Card key={article.id} className="shadow-soft card-hover cursor-pointer">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-3 py-1 bg-secondary/10 text-secondary text-xs font-medium rounded-full">
                      {article.category}
                    </span>
                    <div className="p-1 bg-gradient-hero rounded">
                      <article.icon className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <CardTitle className="text-lg hover:text-primary transition-colors line-clamp-2">
                    {article.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
                    {article.excerpt}
                  </p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{article.author}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{article.date}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{article.readTime}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Signup */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-brain">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-6">Stay Updated</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Get the latest research insights, caregiver tips, and Cog.ai updates delivered to your inbox.
          </p>
          
          <div className="max-w-md mx-auto">
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button className="btn-hero whitespace-nowrap">
                Subscribe
              </button>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              We respect your privacy. Unsubscribe at any time.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Resources;